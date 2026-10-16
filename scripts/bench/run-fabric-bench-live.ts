import { readFile, writeFile, appendFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { createRuntimePaths, validateFabricProject, SystemToolchainProvider, readBridgeDiscovery, bridgeRequest } from '../../packages/modcrafting-core/src/node.ts'
import { GAME_TEST_WORLD } from '../../packages/modcrafting-core/src/domain.ts'
import { FabricRuntime, CoreError, localAssetStatus } from '../../packages/modcrafting-core/src/runtime.ts'
import { summarizeFabricBench, type FabricBenchCaseResult } from '../../packages/modcrafting-core/src/fabric-bench.ts'
import { fabricBenchLiveSchema, runLiveFabricBench, waitBenchJob, settleBenchJob, benchWait, requireBenchWorld, benchCommand } from '../../packages/modcrafting-core/src/fabric-bench-live.ts'
import { prepareBenchRun, copyBenchInput, selectBenchWorld, type BenchWidget, hashTree, executionFingerprint, writeBenchReport } from './bench-support.ts'

const entry = fileURLToPath(import.meta.url)
const { values } = parseArgs({ options: {
  project: { type: 'string' }, 'data-root': { type: 'string' }, 'run-root': { type: 'string' }, suite: { type: 'string' },
  'java-home': { type: 'string' }, 'gradle-user-home': { type: 'string' }, world: { type: 'string' }, offline: { type: 'boolean' },
  'timeout-ms': { type: 'string', default: '300000' }, 'case-timeout-ms': { type: 'string', default: '30000' }, help: { type: 'boolean' }
} })
if (values.help) {
  console.log('Usage: bench:fabric:live --project Fabric-project --data-root Core-data --run-root output-directory [--suite live-suite.json] [--java-home JDK21] [--gradle-user-home cache] [--world ".../ModCrafting Test World"] [--offline] [--timeout-ms 300000] [--case-timeout-ms 30000]')
  process.exit(0)
}
if (!values.project || !values['data-root'] || !values['run-root']) throw Error('--project, --data-root and --run-root are required')
const timeoutMs = Number(values['timeout-ms']), caseTimeoutMs = Number(values['case-timeout-ms'])
if (![timeoutMs, caseTimeoutMs].every((value) => Number.isSafeInteger(value) && value > 0)) throw Error('Timeouts must be positive integer milliseconds')
const suiteFile = path.resolve(values.suite || path.join(path.dirname(entry), 'fabric-bench-live-mvp.json'))
const suiteText = await readFile(suiteFile, 'utf8'), suite = fabricBenchLiveSchema.parse(JSON.parse(suiteText))
const sourceProject = path.resolve(values.project), sourceData = createRuntimePaths(values['data-root'])
const projectCheck = validateFabricProject(sourceProject)
if (!projectCheck.ok) throw Error(`Invalid Fabric project: ${JSON.stringify(projectCheck)}`)
if (values['java-home']) {
  process.env.JAVA_HOME = path.resolve(values['java-home'])
  process.env.PATH = `${path.join(process.env.JAVA_HOME, 'bin')}${path.delimiter}${process.env.PATH || ''}`
}
if (values['gradle-user-home']) process.env.GRADLE_USER_HOME = path.resolve(values['gradle-user-home'])
const owned = await prepareBenchRun(sourceProject, values['run-root'], values.world ? path.resolve(values.world) : undefined)
const paths = createRuntimePaths(path.join(owned.directory, 'data'))
const provider = new SystemToolchainProvider()
const runtime = new FabricRuntime({ paths, version: 'fabric-bench-live-v1', toolchain: {
  status: (project) => provider.status(project),
  startGradle: (project, task, events, args) => provider.startGradle(project, task, events, [...(values.offline ? ['--offline'] : []), ...(args || [])])
} })
const abort = new AbortController(), cancel = () => abort.abort()
process.on('SIGINT', cancel); process.on('SIGTERM', cancel)
const jobs: string[] = [], artifacts: Record<string, unknown> = {}
let result = summarizeFabricBench<FabricBenchCaseResult>(suite.id, 'live', [], suite.cases.length), instanceId: string | undefined
let failed: { code: string; message: string } | undefined
console.log(JSON.stringify({ execution: 'live', reportDirectory: owned.directory }))

async function poll<T>(work: () => Promise<T | undefined>, name: string) {
  const deadline = Date.now() + timeoutMs
  do {
    if (abort.signal.aborted) throw new CoreError('CANCELLED', 'Bench cancelled')
    const value = await work()
    if (value !== undefined) return value
    await benchWait(500)
  } while (Date.now() < deadline)
  throw new CoreError('TIMEOUT', `Timed out waiting for ${name}`)
}
async function enterWorld() {
  const discovery = readBridgeDiscovery(owned.gameDirectory)
  if (!discovery) throw new CoreError('OBSERVER_UNAVAILABLE', 'Bridge discovery missing')
  const inspect = async () => {
    const observed = await bridgeRequest(discovery, 'GET', '/v1/inspect')
    if (!observed.ok) throw new CoreError('OBSERVER_UNAVAILABLE', observed.error || 'Inspect failed')
    const data = observed.data as { screen?: { className?: string; widgets?: BenchWidget[] }; widgets?: BenchWidget[] | { widgets?: BenchWidget[] } }
    return { screen: data.screen, widgets: Array.isArray(data.widgets) ? data.widgets : data.widgets?.widgets || data.screen?.widgets || [] }
  }
  const input = async (action: string, args: Record<string, unknown>) => {
    const observed = await inspect()
    const response = await runtime.input(action, args, instanceId)
    await appendFile(path.join(owned.directory, 'world-menu.jsonl'), JSON.stringify({ at: new Date().toISOString(), action, args, observed, response }) + '\n')
    if (!response.ok) throw new CoreError('ACTION_FAILED', response.error || 'World menu input failed')
  }
  await poll(async () => (await inspect()).screen?.className?.includes('TitleScreen') ? true : undefined, 'title screen')
  await benchWait(2000)
  await input('click_widget', { label: '单人游戏' })
  const menu = await poll(async () => { const value = await inspect(); return value.screen?.className?.includes(values.world ? 'SelectWorldScreen' : 'CreateWorldScreen') ? value : undefined }, 'world menu')
  // Own directory contains either no saves or the single copied dedicated test world.
  if (values.world) {
    await selectBenchWorld(inspect, input, poll)
  } else {
    if (!menu.screen?.className?.includes('CreateWorldScreen')) throw new CoreError('WORLD_UNAVAILABLE', 'Empty isolated directory must open world creation')
    await input('set_text', { text: GAME_TEST_WORLD })
    const widgets = (await inspect()).widgets
    const cheat = widgets.find((row) => /(允许|allow).*(命令|作弊|commands|cheats)/i.test(row.message || row.label || ''))
    if (cheat && !/[:：]\s*(开|开启|ON)\s*$/i.test(cheat.message || cheat.label || '')) await input('click_widget', { label: cheat.message || cheat.label! })
    await input('click_widget', { label: '创建新的世界' })
  }
  return poll(async () => { const observed = await runtime.snapshot(instanceId); return observed.ok && observed.data.worldName === GAME_TEST_WORLD ? observed : undefined }, 'dedicated test world')
}

try {
  artifacts.executionFingerprint = await executionFingerprint(entry, suiteText)
  await writeFile(path.join(owned.directory, 'suite.json'), suiteText, { flag: 'wx' })
  await writeFile(path.join(owned.directory, 'options.json'), JSON.stringify({ sourceProject, sourceDataRoot: sourceData.dataRoot, worldInput: values.world ? path.resolve(values.world) : null, suiteFile, javaHome: process.env.JAVA_HOME || null, gradleUserHome: process.env.GRADLE_USER_HOME || null, offline: Boolean(values.offline), timeoutMs, caseTimeoutMs, ...owned }, null, 2))
  artifacts.projectInputHashes = await hashTree(owned.projectPath)
  const environment = artifacts.environment = await runtime.environmentStatus(owned.projectPath)
  await writeFile(path.join(owned.directory, 'environment.json'), JSON.stringify(environment, null, 2))
  if (!environment.ok) throw new CoreError('ENVIRONMENT_UNAVAILABLE', environment.remediation.join(' '))
  const sourceAssets = artifacts.sourceAssets = localAssetStatus(sourceData)
  if (sourceAssets.find((row) => row.name === 'base-mods')?.status !== 'present') throw new CoreError('ASSET_UNAVAILABLE', 'Prepare real Observer base-mods in --data-root first')
  artifacts.observerHashes = await hashTree(path.join(sourceData.assetsRoot, 'base-mods'))
  // Core's report writer ensures all runtime directories; keep them wholly within this run.
  await copyBenchInput(path.join(sourceData.assetsRoot, 'base-mods'), path.join(paths.assetsRoot, 'base-mods'))
  environment.assets = localAssetStatus(paths)
  await writeFile(path.join(owned.directory, 'environment.json'), JSON.stringify(environment, null, 2))
  const build = runtime.startBuild(owned.projectPath); jobs.push(build.jobId)
  const buildResult = artifacts.build = await waitBenchJob(runtime, build.jobId, timeoutMs, abort.signal)
  await writeFile(path.join(owned.directory, 'build.json'), JSON.stringify(buildResult, null, 2))
  if (buildResult.status !== 'completed' || buildResult.result?.ok !== true) throw new CoreError(buildResult.code || 'BUILD_FAILED', buildResult.error || 'Build failed')
  artifacts.builtJarHashes = await hashTree(path.join(owned.projectPath, 'build', 'libs'))
  await writeFile(path.join(owned.gameDirectory, 'options.txt'), 'lang:zh_cn\nonboardAccessibility:false\nnarrator:0\n')
  const started = artifacts.instance = runtime.runClient(owned.projectPath, owned.gameDirectory); instanceId = started.instanceId; jobs.push(started.jobId)
  artifacts.runtime = await poll(async () => {
    const status = await runtime.runtimeStatus(instanceId)
    if (!('status' in status.job) || status.job.status !== 'running') throw new CoreError('CLIENT_FAILED', JSON.stringify(status.job))
    return status.bridgeReady ? status : undefined
  }, 'Observer V2')
  artifacts.worldObservation = await enterWorld()
  for (const command of ['gamemode creative @s', 'tp @s 0 101 0', 'fill -8 100 -8 8 112 8 minecraft:air', 'fill -8 99 -8 8 99 8 minecraft:stone', 'time set day', 'tp @s 0 101 0 0 25']) await benchCommand(runtime, instanceId, command)
  await benchWait(1000)
  result = await runLiveFabricBench(runtime, suite, instanceId, { caseTimeoutMs, signal: abort.signal, onCase: async (row) => {
    if (row.job) jobs.push(row.job.id)
    await writeFile(path.join(owned.directory, `test-${row.id}.json`), JSON.stringify(row, null, 2), { flag: 'wx' })
    console.log(JSON.stringify({ case: row.id, verdict: row.acceptance.verdict, code: row.acceptance.code, matched: row.matched }))
  } })
  if (!abort.signal.aborted) { await requireBenchWorld(runtime, instanceId); artifacts.screenshot = await runtime.screenshot(instanceId) }
} catch (error) {
  failed = { code: error instanceof CoreError ? error.code : 'BENCH_FAILED', message: String(error) }
} finally {
  runtime.close()
  const shutdown = await Promise.all(jobs.map(async (id) => {
    try { return { id, settled: true, job: await settleBenchJob(runtime, id, 30000) } }
    catch (error) { return { id, settled: false, job: runtime.jobStatus(id), error: String(error) } }
  }))
  const stopped = shutdown.every((row) => row.settled)
  if (!stopped) failed = { code: 'STOP_UNCONFIRMED', message: 'One or more owned workers did not settle; inspect shutdown evidence' }
  process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel)
  await writeBenchReport(owned.directory, { ...result, ok: result.ok && !failed && stopped, inputs: artifacts, shutdown, error: failed || null })
  console.log(JSON.stringify({ execution: 'live', ok: result.ok && !failed && stopped, counts: result.counts, error: failed || null, reportDirectory: owned.directory }))
  process.exitCode = result.ok && !failed && stopped ? 0 : abort.signal.aborted ? 130 : 1
}
