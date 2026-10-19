import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { createRuntimePaths, validateFabricProject, SystemToolchainProvider } from '../../packages/modcrafting-core/src/node.ts'
import { DEFAULT_TEST_PROFILE } from '../../packages/modcrafting-core/src/domain.ts'
import { FabricRuntime, CoreError, localAssetStatus, loadBundledObserver } from '../../packages/modcrafting-core/src/runtime.ts'
import { summarizeFabricBench, type FabricBenchCaseResult } from '../../packages/modcrafting-core/src/fabric-bench.ts'
import { fabricBenchLiveSchema, runLiveFabricBench, waitBenchJob, settleBenchJob, requireBenchWorld, benchCommand, waitBenchReady, benchWait } from '../../packages/modcrafting-core/src/fabric-bench-live.ts'
import { prepareBenchRun, copyBenchInput, hashTree, executionFingerprint, writeBenchReport } from './bench-support.ts'

const entry = fileURLToPath(import.meta.url)
const { values } = parseArgs({ options: {
  project: { type: 'string' }, 'data-root': { type: 'string' }, 'run-root': { type: 'string' }, suite: { type: 'string' },
  'java-home': { type: 'string' }, 'gradle-user-home': { type: 'string' }, 'observer-dir': { type: 'string' }, world: { type: 'string' }, offline: { type: 'boolean' },
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
const provider = new SystemToolchainProvider(paths.dataRoot)
let bundledObserver: ReturnType<typeof loadBundledObserver> | undefined, observerError: unknown
try { bundledObserver = loadBundledObserver(path.resolve(values['observer-dir'] || path.join(path.dirname(entry), '../observer'))) } catch (error) { observerError = error }
const runtime = new FabricRuntime({ paths, version: 'fabric-bench-live-v1', observer: bundledObserver, toolchain: {
  status: (project) => provider.status(project),
  startGradle: (project, task, events, args) => provider.startGradle(project, task, events, [...(values.offline ? ['--offline'] : []), ...(args || [])])
} })
const sessionId = runtime.createSession({ name: 'Fabric live validation', projectPath: owned.projectPath }).sessionId
const profile = owned.worldInput
  ? { ...DEFAULT_TEST_PROFILE, map: { source: 'save_copy' as const, terrain: 'normal' as const, seed: '0', sourcePath: owned.worldInput } }
  : structuredClone(DEFAULT_TEST_PROFILE)
runtime.setTestProfile(sessionId, profile, { projectPath: owned.projectPath })
const abort = new AbortController(), cancel = () => abort.abort()
process.on('SIGINT', cancel); process.on('SIGTERM', cancel)
const jobs: string[] = [], artifacts: Record<string, unknown> = {}
let result = summarizeFabricBench<FabricBenchCaseResult>(suite.id, 'live', [], suite.cases.length), instanceId: string | undefined
let failed: { code: string; message: string } | undefined
console.log(JSON.stringify({ execution: 'live', reportDirectory: owned.directory }))

try {
  artifacts.executionFingerprint = await executionFingerprint(entry, suiteText)
  await writeFile(path.join(owned.directory, 'suite.json'), suiteText, { flag: 'wx' })
  await writeFile(path.join(owned.directory, 'options.json'), JSON.stringify({ sourceProject, sourceDataRoot: sourceData.dataRoot, worldInput: owned.worldInput || null, suiteFile, javaHome: process.env.JAVA_HOME || null, gradleUserHome: process.env.GRADLE_USER_HOME || null, offline: Boolean(values.offline), timeoutMs, caseTimeoutMs, projectPath: owned.projectPath, sessionId, testProfile: profile }, null, 2))
  artifacts.projectInputHashes = await hashTree(owned.projectPath)
  artifacts.worldInputHashes = owned.worldInput ? await hashTree(owned.worldInput) : null
  const environment = artifacts.environment = await runtime.environmentStatus(owned.projectPath)
  await writeFile(path.join(owned.directory, 'environment.json'), JSON.stringify(environment, null, 2))
  if (!environment.ok) throw new CoreError('ENVIRONMENT_UNAVAILABLE', environment.remediation.join(' '))
  if (observerError) throw new CoreError('OBSERVER_UPDATE_REQUIRED', 'Use the complete product Observer directory or --observer-dir with its manifest and matching jar')
  artifacts.sourceAssets = localAssetStatus(sourceData, bundledObserver)
  artifacts.observerHashes = { bundledObserver: bundledObserver.sha256 }
  environment.assets = localAssetStatus(paths, bundledObserver)
  await writeFile(path.join(owned.directory, 'environment.json'), JSON.stringify(environment, null, 2))
  const build = runtime.startBuild(owned.projectPath, 'build', sessionId); jobs.push(build.jobId)
  const buildResult = artifacts.build = await waitBenchJob(runtime, build.jobId, sessionId, timeoutMs, abort.signal)
  await writeFile(path.join(owned.directory, 'build.json'), JSON.stringify(buildResult, null, 2))
  if (buildResult.status !== 'completed' || buildResult.result?.ok !== true) throw new CoreError(buildResult.code || 'BUILD_FAILED', buildResult.error || 'Build failed')
  artifacts.builtJarHashes = await hashTree(path.join(owned.projectPath, 'build', 'libs'))
  const started = artifacts.instance = runtime.runClient(owned.projectPath, undefined, sessionId); instanceId = started.instanceId; jobs.push(started.jobId, started.preparationJobId)
  artifacts.runtime = await waitBenchReady(runtime, instanceId, sessionId, timeoutMs, abort.signal)
  artifacts.worldObservation = await requireBenchWorld(runtime, instanceId, sessionId)
  for (const command of ['gamemode creative @s', 'tp @s 0 101 0', 'fill -8 100 -8 8 112 8 minecraft:air', 'fill -8 99 -8 8 99 8 minecraft:stone', 'time set day', 'tp @s 0 101 0 0 25']) await benchCommand(runtime, instanceId, sessionId, command)
  await benchWait(1000)
  result = await runLiveFabricBench(runtime, suite, instanceId, { sessionId, caseTimeoutMs, signal: abort.signal, onCase: async (row) => {
    if (row.job) jobs.push(row.job.id)
    await writeFile(path.join(owned.directory, `test-${row.id}.json`), JSON.stringify(row, null, 2), { flag: 'wx' })
    console.log(JSON.stringify({ case: row.id, verdict: row.acceptance.verdict, code: row.acceptance.code, matched: row.matched }))
  } })
  if (!abort.signal.aborted) { await requireBenchWorld(runtime, instanceId, sessionId); artifacts.screenshot = await runtime.screenshot(instanceId, sessionId) }
} catch (error) {
  failed = { code: error instanceof CoreError ? error.code : 'BENCH_FAILED', message: String(error) }
} finally {
  runtime.close()
  const shutdown = await Promise.all(jobs.map(async (id) => {
    try { return { id, settled: true, job: await settleBenchJob(runtime, id, sessionId, 30000) } }
    catch (error) { return { id, settled: false, job: runtime.jobStatus(id, sessionId), error: String(error) } }
  }))
  const stopped = shutdown.every((row) => row.settled)
  if (!stopped) failed = { code: 'STOP_UNCONFIRMED', message: 'One or more owned workers did not settle; inspect shutdown evidence' }
  const worldInputUnchanged = !owned.worldInput || JSON.stringify(await hashTree(owned.worldInput)) === JSON.stringify(artifacts.worldInputHashes)
  artifacts.worldInputUnchanged = worldInputUnchanged
  if (!worldInputUnchanged && !failed) failed = { code: 'WORLD_INPUT_CHANGED', message: 'The source save changed during the isolated validation run.' }
  try { runtime.endSession(sessionId) } catch (error) { if (!failed) failed = { code: 'SESSION_END_FAILED', message: String(error) } }
  process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel)
  await writeBenchReport(owned.directory, { ...result, ok: result.ok && !failed && stopped, inputs: artifacts, shutdown, error: failed || null })
  console.log(JSON.stringify({ execution: 'live', ok: result.ok && !failed && stopped, counts: result.counts, error: failed || null, reportDirectory: owned.directory }))
  process.exitCode = result.ok && !failed && stopped ? 0 : abort.signal.aborted ? 130 : 1
}
