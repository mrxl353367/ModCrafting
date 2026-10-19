import assert from 'node:assert/strict'
import { fixtureObserver } from './fixtures/observer.ts'
import test from 'node:test'
import { spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdtemp, mkdir, readFile, writeFile, symlink, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { FabricRuntime, createRuntimePaths, FABRIC_TARGET, GAME_TEST_WORLD } from '../../packages/modcrafting-core/src/index.ts'
import { fabricBenchLiveSchema, runLiveFabricBench, settleBenchJob } from '../../packages/modcrafting-core/src/fabric-bench-live.ts'
import { prepareBenchRun, copyBenchInput, hashTree } from '../bench/bench-support.ts'

const suite = JSON.parse(await readFile(new URL('../bench/fabric-bench-live-mvp.json', import.meta.url), 'utf8'))
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const scope = () => mkdtemp(path.join(os.tmpdir(), 'modcrafting-live-bench-fixture-'))
async function inputProject(directory: string) {
  const project = path.join(directory, 'input with spaces')
  await mkdir(path.join(project, 'src/main/resources'), { recursive: true })
  await writeFile(path.join(project, 'src/main/resources/fabric.mod.json'), JSON.stringify({ id: 'bench_fixture' }))
  await writeFile(path.join(project, 'gradle.properties'), 'minecraft_version=1.21.4\n')
  await writeFile(path.join(project, 'gradlew.bat'), '@echo FIXTURE_ONLY\n')
  return project
}
async function fixture(t: { after: (work: () => Promise<void>) => void }, modsInput?: string) {
  const directory = await scope(), project = await inputProject(directory)
  const paths = createRuntimePaths(path.join(directory, 'data'))
  if (modsInput) await copyBenchInput(modsInput, path.join(paths.assetsRoot, 'base-mods'))
  else {
    await mkdir(path.join(paths.assetsRoot, 'base-mods'), { recursive: true })
    await writeFile(path.join(paths.assetsRoot, 'base-mods/modcrafting-observer-fixture.jar'), 'Fixture only')
  }
  const runtime = new FabricRuntime({ paths, version: 'bench-fixture', observer: fixtureObserver, toolchain: {
    status: async () => ({ ok: true, platform: process.platform, node: process.version, java: { ok: true }, gradleWrapper: true, target: FABRIC_TARGET, remediation: [] }),
    startGradle: async () => spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { windowsHide: true, stdio: 'ignore' })
  } })
  const sessionId = runtime.createSession({ name: 'live bench fixture', projectPath: project }).sessionId
  const client = runtime.runClient(project, undefined, sessionId)
  let sequence = 0, world = GAME_TEST_WORLD, count = 0
  const commands: string[] = []
  const server = createServer(async (request, response) => {
    assert.equal(request.headers.authorization, 'Bearer fixture-token')
    let text = ''; for await (const part of request) text += String(part)
    const body = text ? JSON.parse(text) : {}
    let data: Record<string, unknown> = request.url === '/v2/capabilities' ? { ok: true, protocolVersion: 2 }
      : request.url === '/v2/test-preparation' ? { ok: true, phase: 'test_ready', ready: true, screen: { simpleName: 'TitleScreen' } }
      : { ok: true, executed: true }
    if (request.url === '/v2/snapshot') data = { ok: true, worldName: world, requestId: `fixture_${++sequence}`, observedAt: Date.now(), inventory: { ok: true, hotbar: [], main: count ? [{ id: 'minecraft:stone', count }] : [], armor: [], offhand: [] }, entities: [] }
    if (request.url === '/v2/command') {
      commands.push(body.command)
      if (body.command.startsWith('give ')) count = 1
      if (body.command.startsWith('clear ')) count = 0
      if (body.command.includes('deliberately_invalid')) data = { ok: false, executed: false }
    }
    response.setHeader('content-type', 'application/json'); response.end(JSON.stringify(data))
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  await writeFile(path.join(client.gameDirectory, 'modcrafting-bridge.json'), JSON.stringify({ port: (server.address() as { port: number }).port, token: 'fixture-token' }))
  t.after(async () => { runtime.close(); await settleBenchJob(runtime, client.jobId, sessionId, 5000); await new Promise<void>((resolve) => server.close(() => resolve())) })
  return { runtime, client, sessionId, commands, setWorld: (value: string) => { world = value } }
}
test('Live suite reuses V2 validation and rejects fixture, malformed and duplicate input before execution', () => {
  assert.equal(fabricBenchLiveSchema.parse(suite).cases.length, 10)
  assert.throws(() => fabricBenchLiveSchema.parse({ ...suite, execution: 'fixture' }))
  assert.throws(() => fabricBenchLiveSchema.parse({ ...suite, cases: [suite.cases[0], suite.cases[0]] }))
  assert.throws(() => fabricBenchLiveSchema.parse({ ...suite, cases: [{ ...suite.cases[0], spec: { ...suite.cases[0].spec, actions: [] } }] }))
  assert.throws(() => fabricBenchLiveSchema.parse({ ...suite, cases: [suite.cases[0], { ...suite.cases[1], spec: suite.cases[0].spec }] }))
})
test('Bench isolates project inputs while leaving save copying to the product runtime', async () => {
  const directory = await scope(), project = await inputProject(directory)
  for (const name of ['build', 'run', '.gradle', 'node_modules']) { await mkdir(path.join(project, name)); await writeFile(path.join(project, name, 'fixture.txt'), name) }
  await writeFile(path.join(project, '.env'), 'FIXTURE_ONLY=true')
  const world = path.join(directory, GAME_TEST_WORLD); await mkdir(world); await writeFile(path.join(world, 'level.dat'), 'Fixture only')
  const before = await hashTree(project), worldBefore = await hashTree(world)
  const first = await prepareBenchRun(project, path.join(directory, 'results'), world)
  const second = await prepareBenchRun(project, path.join(directory, 'results'), world)
  assert.notEqual(first.directory, second.directory)
  assert.equal(first.worldInput, world)
  assert.equal(existsSync(path.join(first.directory, 'game')), false, 'the harness must not prepare a game directory or copy the source world')
  assert.deepEqual((await readdir(first.projectPath)).sort(), ['gradle.properties', 'gradlew.bat', 'src'])
  await writeFile(path.join(first.projectPath, 'gradle.properties'), 'fixture changed')
  assert.deepEqual(await hashTree(project), before); assert.deepEqual(await hashTree(world), worldBefore)
})
test('Bench refuses nested/junction output and linked input instead of touching original directories', async () => {
  const directory = await scope(), project = await inputProject(directory)
  await assert.rejects(() => prepareBenchRun(project, path.join(project, 'new-results')), /outside/)
  assert.equal(existsSync(path.join(project, 'new-results')), false)
  const alias = path.join(directory, 'output-junction'); await symlink(project, alias, process.platform === 'win32' ? 'junction' : 'dir')
  await assert.rejects(() => prepareBenchRun(project, path.join(alias, 'new-results')), /outside/)
  const external = path.join(directory, 'external'); await mkdir(external)
  await symlink(external, path.join(project, 'linked'), process.platform === 'win32' ? 'junction' : 'dir')
  await assert.rejects(() => prepareBenchRun(project, path.join(directory, 'results')), /symlinks or junctions/)
})
test('Copied Observer resources keep Core report directory creation away from input data', async (t) => {
  const source = path.join(await scope(), 'source-data')
  const mods = path.join(source, 'assets/base-mods'); await mkdir(mods, { recursive: true })
  await writeFile(path.join(mods, 'modcrafting-observer-input-fixture.jar'), 'Immutable resource fixture')
  const before = await hashTree(source)
  const f = await fixture(t, mods)
  const report = await runLiveFabricBench(f.runtime, { ...suite, cases: [suite.cases[0]] }, f.client.instanceId, { sessionId: f.sessionId })
  assert.equal(report.ok, true); assert.ok(existsSync(f.runtime.paths.reportsRoot))
  assert.deepEqual(await hashTree(source), before)
  assert.deepEqual((await readdir(source)).sort(), ['assets'])
  assert.equal(existsSync(path.join(source, 'knowledge')), false)
  assert.equal(existsSync(path.join(source, 'reports')), false)
})
test('Live Bench matches PASS/FAIL/cleanup failure/unavailable reports without laundering verdicts', async (t) => {
  const f = await fixture(t), saved: string[] = []
  const selected = { ...suite, cases: [suite.cases[0], suite.cases[1], suite.cases[8], suite.cases[9]] }
  const report = await runLiveFabricBench(f.runtime, selected, f.client.instanceId, { sessionId: f.sessionId, onCase: async (row) => { saved.push(row.id) } })
  assert.equal(report.ok, true); assert.equal(report.counts.matched, 4)
  assert.deepEqual(report.counts.verdicts, { PASS: 1, FAIL: 1, INCONCLUSIVE: 2 })
  assert.equal(report.cases[2].acceptance.cleanup.status, 'failed')
  assert.ok(report.cases.every((row) => row.acceptance.execution === 'live' && row.job?.result?.reportPath))
  assert.deepEqual(saved, selected.cases.map((row: { id: string }) => row.id))
  // HTTP/process fixtures exercise the live path but are explicitly not Minecraft evidence.
})
test('Live Bench gates prepare commands on a fresh exact world observation', async (t) => {
  const f = await fixture(t); f.setWorld('Ordinary World')
  const report = await runLiveFabricBench(f.runtime, { ...suite, cases: [suite.cases[0], suite.cases[1]] }, f.client.instanceId, { sessionId: f.sessionId })
  assert.equal(report.ok, false); assert.equal(report.cases[0].acceptance.code, 'WORLD_UNAVAILABLE')
  assert.deepEqual(f.commands, []); assert.equal(report.counts.notRun, 1)
})
test('Case timeout waits for Core finally cleanup and retains raw evidence without PASS', async (t) => {
  const f = await fixture(t)
  const first = structuredClone(suite.cases[0]); first.spec.actions = [{ type: 'wait', ms: 200 }]
    const report = await runLiveFabricBench(f.runtime, { ...suite, cases: [first, suite.cases[1]] }, f.client.instanceId, { sessionId: f.sessionId, caseTimeoutMs: 50 })
  assert.equal(report.ok, false); assert.equal(report.cases[0].acceptance.verdict, 'INCONCLUSIVE')
  assert.equal(report.cases[0].acceptance.code, 'TIMEOUT'); assert.equal(report.cases[0].acceptance.cleanup.status, 'complete')
  assert.equal(report.cases[0].job?.status, 'stopped'); assert.ok(report.cases[0].job?.result?.reportPath)
  assert.equal(report.counts.notRun, 1)
})
test('Cancellation retains CLEANUP_FAILED rather than hiding it behind a stopped acknowledgement', async (t) => {
  const f = await fixture(t), abort = new AbortController()
  const row = structuredClone(suite.cases[8]); row.spec.actions = [{ type: 'wait', ms: 200 }]
  const timer = setTimeout(() => abort.abort(), 75)
  try {
    const report = await runLiveFabricBench(f.runtime, { ...suite, cases: [row] }, f.client.instanceId, { sessionId: f.sessionId, signal: abort.signal })
    assert.equal(report.ok, false); assert.equal(report.cases[0].acceptance.code, 'CLEANUP_FAILED')
    assert.equal(report.cases[0].acceptance.cleanup.status, 'failed'); assert.ok(report.cases[0].job?.result)
  } finally { clearTimeout(timer) }
})
test('Live CLI explains prerequisites and preserves a diagnostic run without starting Minecraft', async () => {
  const directory = await scope(), project = await inputProject(directory)
  const cli = path.join(root, 'scripts/bench/run-fabric-bench-live.ts')
  const usage = spawnSync(process.execPath, ['--experimental-strip-types', cli, '--help'], { encoding: 'utf8', windowsHide: true })
  assert.equal(usage.status, 0); assert.match(usage.stdout, /--project.*--data-root/)
  const result = spawnSync(process.execPath, ['--experimental-strip-types', cli, '--project', project, '--data-root', path.join(directory, 'missing-assets'), '--run-root', path.join(directory, 'results')], { encoding: 'utf8', windowsHide: true, timeout: 15000, env: { ...process.env, JAVA_HOME: path.join(directory, 'missing-jdk'), PATH: path.dirname(process.execPath) } })
  assert.equal(result.status, 1, result.stderr)
  const output = JSON.parse(result.stdout.trim().split('\n').at(-1)!)
  assert.equal(output.ok, false); assert.equal(output.error.code, 'ENVIRONMENT_UNAVAILABLE')
  const report = JSON.parse(await readFile(path.join(output.reportDirectory, 'report.json'), 'utf8'))
  assert.equal(report.counts.executed, 0); assert.equal(report.counts.notRun, 10); assert.deepEqual(report.shutdown, [])
  assert.equal(existsSync(path.join(project, 'build')), false)
})
