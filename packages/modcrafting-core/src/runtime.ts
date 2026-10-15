import { existsSync, mkdirSync, readdirSync, copyFileSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import type { ChildProcess } from 'node:child_process'
import { FABRIC_TARGET, validateGameTestSpec, type GameAction, type GameTestSpec } from './domain.ts'
import { executeGameTest, SUPPORTED_GAME_ASSERTIONS } from './game-test.ts'
import { JobManager, SystemToolchainProvider, bridgeRequest, readBridgeDiscovery, prepareAssets, writeGameTestReport, type BridgeDiscovery } from './node.ts'
import type { RuntimePaths, CoreEnvironmentStatus, CoreCapabilities, LocalAssetStatus, GameInstance, GameRuntimeStatus, JobSnapshot, CoreFailure, BridgeResult, CoreRuntimeState } from './contracts.ts'

export class CoreError extends Error {
  readonly code: string
  constructor(code: string, message: string) { super(message); this.name = 'CoreError'; this.code = code }
}
export const CORE_CAPABILITIES: CoreCapabilities = {
  contractVersion: 1, supportedAssertions: SUPPORTED_GAME_ASSERTIONS,
  unsupportedAssertions: ['hud_text', 'command_result', 'entity_exists:tag', 'trace_source'],
  entityQuery: { radius: 32, limit: 64, tagFilters: false },
  toolchain: { source: 'system', automaticDownload: false, scaffoldIncludesWrapper: false }
}

function filesUnder(directory: string): string[] {
  if (!existsSync(directory) || !statSync(directory).isDirectory()) return []
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name)
    return entry.isDirectory() ? filesUnder(file) : entry.isFile() ? [file] : []
  })
}
export function localAssetStatus(paths: RuntimePaths): LocalAssetStatus[] {
  const docs = path.join(paths.knowledgeRoot, 'agent-knowledge', 'fabric')
  const checks = [
    { name: 'minecraft-data', path: path.join(paths.knowledgeRoot, 'minecraft-data', FABRIC_TARGET.minecraft, 'index.json'), kind: 'object' },
    { name: 'mc-wiki-zh', path: path.join(paths.knowledgeRoot, 'mc-wiki-zh'), kind: 'directory' },
    { name: 'mc-wiki-zh-index', path: path.join(paths.knowledgeRoot, 'mc-wiki-zh-index', 'chunks.json'), kind: 'array' },
    { name: 'fabric-docs', path: existsSync(docs) ? docs : path.join(paths.assetsRoot, 'agent-knowledge', 'fabric'), kind: 'markdown' },
    { name: 'base-mods', path: path.join(paths.assetsRoot, 'base-mods'), kind: 'observer' }
  ]
  return checks.map((check) => {
    if (!existsSync(check.path)) return { name: check.name, path: check.path, status: 'missing' }
    try {
      if (check.kind === 'object' || check.kind === 'array') {
        const value = JSON.parse(readFileSync(check.path, 'utf8'))
        if (check.kind === 'array' ? !Array.isArray(value) : !value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid JSON shape')
      } else {
        const files = filesUnder(check.path).filter((file) => statSync(file).size > 0)
        if (!files.some((file) => check.kind === 'observer' ? /modcrafting-observer.*\.jar$/i.test(path.basename(file)) : check.kind === 'markdown' ? file.endsWith('.md') : true)) throw Error('Required resource files are missing')
      }
      return { name: check.name, path: check.path, status: 'present' }
    } catch { return { name: check.name, path: check.path, status: 'invalid', error: 'Local resource layout is invalid; prepare assets explicitly' } }
  })
}

export function resolveProjectPath(value: string): string {
  const root = path.resolve(value)
  if (!existsSync(root) || !statSync(root).isDirectory()) throw new CoreError('PROJECT_UNAVAILABLE', 'projectPath does not exist or is not a directory')
  return root
}
const waitForChild = (child: ChildProcess) => new Promise<number>((resolve, reject) => { child.once('error', reject); child.once('close', (value) => resolve(value ?? -1)) })

/** One owner of build/game/test jobs, reusable by MCP, Bench and optional views. */
export class FabricRuntime {
  private jobs = new JobManager()
  private instances = new Map<string, GameInstance>()
  private sequence = 0
  private preparation?: ReturnType<typeof prepareAssets>
  private toolchain: Pick<SystemToolchainProvider, 'status' | 'startGradle'>
  readonly paths: RuntimePaths
  readonly version: string
  constructor(options: { paths: RuntimePaths; version: string; toolchain?: Pick<SystemToolchainProvider, 'status' | 'startGradle'> }) {
    this.paths = options.paths; this.version = options.version; this.toolchain = options.toolchain ?? new SystemToolchainProvider()
  }
  async environmentStatus(projectPath?: string): Promise<CoreEnvironmentStatus> {
    return { ...(await this.toolchain.status(projectPath)), contractVersion: 1, paths: this.paths, assets: localAssetStatus(this.paths), capabilities: CORE_CAPABILITIES }
  }
  async prepareAssets() {
    // Existing extraction uses PID-based staging; concurrent callers share one preparation.
    const work = this.preparation ??= prepareAssets(this.paths)
    try {
      const assets = await work
      return { ok: assets.length > 0 && assets.every((asset) => asset.ok), assets, dataRoot: this.paths.dataRoot, localAssets: localAssetStatus(this.paths) }
    } finally { if (this.preparation === work) this.preparation = undefined }
  }
  startBuild(projectPath: string, task = 'build') {
    if (!/^[A-Za-z][A-Za-z0-9:.-]*$/.test(task)) throw new CoreError('INVALID_ARGUMENT', 'Invalid Gradle task')
    const root = resolveProjectPath(projectPath)
    const jobId = this.jobs.start('build', async (job) => {
      const child = await this.toolchain.startGradle(root, task, { onLog: (_, line) => job.output.push(line) })
      job.setChild(child); const code = await waitForChild(child)
      if (job.cancelled()) return { ok: false, task, exitCode: code, code: 'CANCELLED' }
      if (code !== 0) throw new CoreError('BUILD_FAILED', `Gradle ${task} exited ${code}`)
      return { ok: true, task, exitCode: code }
    })
    return { ok: true, jobId }
  }
  runClient(projectPath: string, gameDirectory?: string) {
    const root = resolveProjectPath(projectPath), gameDir = path.resolve(gameDirectory || path.join(root, 'run', 'modcrafting-fabric'))
    const key = (value: string) => process.platform === 'win32' ? value.toLowerCase() : value
    if ([...this.instances.values()].some((current) => {
      const job = this.jobs.status(current.jobId)
      return key(current.gameDirectory) === key(gameDir) && (job.status === 'running' || job.status === 'stopped' && !job.result && !job.error)
    })) throw new CoreError('INSTANCE_CONFLICT', 'Game directory belongs to an active or stopping instance')
    const jars = filesUnder(path.join(this.paths.assetsRoot, 'base-mods')).filter((file) => file.toLowerCase().endsWith('.jar'))
    if (!jars.some((file) => /modcrafting-observer/i.test(path.basename(file)))) throw new CoreError('ASSET_UNAVAILABLE', 'Observer V2 base mods are unavailable; run modcrafting_prepare_assets first')
    mkdirSync(path.join(gameDir, 'mods'), { recursive: true })
    for (const jar of jars) copyFileSync(jar, path.join(gameDir, 'mods', path.basename(jar)))
    const gameArgs = `--args=--gameDir \"${gameDir.replace(/\\/g, '/')}\"`
    const jobId = this.jobs.start('minecraft', async (job) => {
      const child = await this.toolchain.startGradle(root, 'runClient', { onLog: (_, line) => job.output.push(line) }, [gameArgs])
      job.setChild(child); const code = await waitForChild(child)
      if (job.cancelled()) return { exitCode: code, code: 'CANCELLED' }
      if (code !== 0) throw new CoreError('CLIENT_FAILED', `Minecraft runClient exited ${code}`)
      return { exitCode: code }
    })
    const instanceId = `instance_${Date.now().toString(36)}_${++this.sequence}`
    this.instances.set(instanceId, { instanceId, projectPath: root, gameDirectory: gameDir, jobId })
    return { ok: true, instanceId, jobId, gameDirectory: gameDir }
  }
  private instance(id?: string): GameInstance {
    const value = id ? this.instances.get(id) : Array.from(this.instances.values()).at(-1)
    if (!value) throw new CoreError('INSTANCE_UNAVAILABLE', 'no Minecraft instance is running')
    return value
  }
  private discovery(current: GameInstance): BridgeDiscovery {
    const job = this.jobStatus(current.jobId)
    if (!('status' in job) || job.status !== 'running') throw new CoreError('OBSERVER_UNAVAILABLE', 'Minecraft instance is not running')
    const discovery = readBridgeDiscovery(current.gameDirectory)
    if (!discovery) throw new CoreError('OBSERVER_UNAVAILABLE', 'Observer bridge is not ready; wait for minecraft_runtime_status')
    return discovery
  }
  async runtimeStatus(id?: string): Promise<GameRuntimeStatus> {
    const current = this.instance(id), job = this.jobStatus(current.jobId)
    const discovery = 'status' in job && job.status === 'running' ? readBridgeDiscovery(current.gameDirectory) : null
    const capabilities = discovery ? await bridgeRequest(discovery, 'GET', '/v2/capabilities') : undefined
    return { ok: true, ...current, job, bridgeReady: Boolean(capabilities?.ok && capabilities.data.protocolVersion === 2), capabilities: capabilities?.data }
  }
  stopClient(id?: string) { return this.jobs.stop(this.instance(id).jobId) }
  async snapshot(id?: string, spec?: GameTestSpec): Promise<BridgeResult> {
    return this.snapshotFor(this.instance(id), spec)
  }
  private snapshotFor(current: GameInstance, spec?: GameTestSpec): Promise<BridgeResult> {
    const blocks = spec?.assertions.filter((value) => value.type === 'block_equals').map(({ x, y, z }) => ({ x, y, z })) || [{ x: 0, y: 100, z: 4 }]
    return bridgeRequest(this.discovery(current), 'POST', '/v2/snapshot', { blocks, entityRadius: 32, includeRecipes: true })
  }
  command(command: string, id?: string) { return bridgeRequest(this.discovery(this.instance(id)), 'POST', '/v2/command', { command }) }
  input(action: string, args?: Record<string, unknown>, id?: string) { return bridgeRequest(this.discovery(this.instance(id)), 'POST', '/v1/input', { ...(args || {}), action }) }
  screenshot(id?: string) { return bridgeRequest(this.discovery(this.instance(id)), 'GET', '/v1/screenshot') }
  private async action(current: GameInstance, action: GameAction) {
    if (action.type === 'wait') { await new Promise((resolve) => setTimeout(resolve, action.ms)); return { ok: true, data: {} } }
    const discovery = this.discovery(current)
    if (action.type === 'input') return bridgeRequest(discovery, 'POST', '/v1/input', { ...(action.args || {}), action: action.action })
    const call = await bridgeRequest(discovery, 'POST', '/v2/command', { command: action.command })
    return { ok: call.ok && call.data.executed === true, data: call.data }
  }
  startTest(raw: unknown, id?: string) {
    const parsed = validateGameTestSpec(raw)
    if ('error' in parsed) throw new CoreError(parsed.code, parsed.error)
    // Capture the actual instance once; another client must not redirect this test.
    const current = this.instance(id)
    const jobId = this.jobs.start('game_test', async (job) => {
      const report = await executeGameTest(parsed.spec, {
        snapshot: (spec) => this.snapshotFor(current, spec), action: (action) => this.action(current, action), cancelled: job.cancelled
      }, this.version)
      const reportPath = await writeGameTestReport(this.paths, parsed.spec.id, { ...report, spec: parsed.spec, instanceId: current.instanceId, gameDirectory: current.gameDirectory, createdAt: new Date().toISOString() })
      return { ...report, reportPath }
    })
    return { ok: true, jobId, scenarioId: parsed.spec.id }
  }
  jobStatus(id: string): JobSnapshot | CoreFailure { return this.jobs.status(id) as JobSnapshot | CoreFailure }
  state(): CoreRuntimeState { return { contractVersion: 1, jobs: this.jobs.list() as JobSnapshot[], instances: [...this.instances.values()].map((value) => ({ ...value })) } }
  stopJob(id: string) { return this.jobs.stop(id) }
  close(): void { this.jobs.stopAll() }
}
