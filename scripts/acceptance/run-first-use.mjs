import assert from 'node:assert/strict'
import { mkdtemp, mkdir, cp, readFile, writeFile, copyFile, lstat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { copyBenchInput, hashTree, selectBenchWorld } from '../bench/bench-support.ts'
import { bridgeRequest, readBridgeDiscovery } from '../../packages/modcrafting-core/src/node.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const { values } = parseArgs({ options: { 'product-dir': { type: 'string' }, 'assets-data': { type: 'string' }, 'world-input': { type: 'string' }, 'run-root': { type: 'string' }, help: { type: 'boolean' } } })
if (values.help) { console.log('Usage: acceptance:first-use --product-dir COMPLETE-PRODUCT --assets-data PREPARED-DATA --world-input DEDICATED-TEST-WORLD --run-root NEW-RUNS-ROOT. Requires JDK21 on PATH/JAVA_HOME. Explicitly runs Minecraft and reserved-region tests in a new world copy; never reads model credentials or publishes.'); process.exit(0) }
for (const key of ['product-dir', 'assets-data', 'world-input', 'run-root']) if (!values[key] || !path.isAbsolute(values[key])) throw Error(`--${key} must be absolute`)
const product = values['product-dir'], assets = values['assets-data'], worldInput = values['world-input'], runRoot = values['run-root']
if (path.basename(worldInput) !== 'ModCrafting Test World') throw Error('Only the dedicated test world is allowed')
for (const input of [product, assets, worldInput, runRoot]) {
  for (let current = input; ; current = path.dirname(current)) {
    try { if ((await lstat(current)).isSymbolicLink()) throw Error('Input/output must not traverse a junction/symlink') }
    catch (error) { if (error.code !== 'ENOENT') throw error }
    if (path.dirname(current) === current) break
  }
}
for (const input of [product, assets, worldInput]) {
  const relative = path.relative(input, runRoot)
  if (!relative || relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) throw Error('Run root must be outside every input')
}
if (!(await lstat(path.join(worldInput, 'level.dat'))).isFile()) throw Error('Dedicated world must contain level.dat')
const before = await Promise.all([product, assets, worldInput].map(hashTree))
await mkdir(runRoot, { recursive: true }); const scope = await mkdtemp(path.join(runRoot, 'run-'))
const data = path.join(scope, 'data'), project = path.join(scope, 'project'), game = path.join(scope, 'game')
await mkdir(path.join(data, 'knowledge/minecraft-data/1.21.4'), { recursive: true })
await copyFile(path.join(assets, 'knowledge/minecraft-data/1.21.4/index.json'), path.join(data, 'knowledge/minecraft-data/1.21.4/index.json'))
await copyBenchInput(path.join(assets, 'assets/base-mods'), path.join(data, 'assets/base-mods'))
// Explicit product compatibility step, on our own new cache only; preserve input assets.
await copyFile(path.join(product, 'observer/modcrafting-observer.jar'), path.join(data, 'assets/base-mods/modcrafting-observer.jar'))
await copyBenchInput(worldInput, path.join(game, 'saves/ModCrafting Test World'))
await writeFile(path.join(game, 'options.txt'), 'lang:zh_cn\nonboardAccessibility:false\npauseOnLostFocus:false\nnarrator:0\n')
const save = (name, value) => writeFile(path.join(scope, `${name}.json`), JSON.stringify(value, null, 2))
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function poll(work, name, timeout = 300000) { const deadline = Date.now() + timeout; do { const value = await work(); if (value) return value; await sleep(300) } while (Date.now() < deadline); throw Error('TIMEOUT: ' + name) }
class Transport extends StdioClientTransport { async start() { await super.start(); this.child = this._process; this.exit = new Promise((resolve) => this.child.once('exit', resolve)) } }
const transport = new Transport({ command: process.execPath, args: [path.join(product, 'plugin/dist/mcp-server.js'), '--web'], cwd: product, env: { MODCRAFTING_DATA: data, JAVA_HOME: process.env.JAVA_HOME, GRADLE_USER_HOME: process.env.GRADLE_USER_HOME, PATH: process.env.PATH }, stderr: 'pipe' }); transport.stderr.on('data', () => {})
const client = new Client({ name: 'codex-real-mod-first-use', version: '1' }, { versionNegotiation: { mode: 'legacy' } }); client.onerror = () => {}
const trace = [], jobs = [], summary = { ok: false, scope, execution: 'live', resourceCache: 'explicit prepared input copy', gradleCache: 'explicit existing cache', cases: [] }
async function call(name, args = {}) { const response = await client.callTool({ name, arguments: args }, { timeout: 20000 }); const value = response.structuredContent || JSON.parse(response.content.find((part) => part.type === 'text').text); trace.push({ name, arguments: args, result: value }); return value }
async function settled(id) { return poll(async () => { const value = await call('fabric_job_status', { jobId: id }); return value.result || value.error ? value : undefined }, id) }
let instance
console.log(JSON.stringify({ step: 'first-use-start', scope }))
try {
  await client.connect(transport); summary.serverPid = transport.child.pid
  assert.equal((await client.listTools()).tools.length, 19)
  const environment = await call('modcrafting_environment_status'); assert.equal(environment.java.ok, true)
  for (const [kind, query] of [['item', 'iron_ingot'], ['block', 'stone'], ['block', 'air']]) assert.equal((await call('minecraft_data_lookup', { kind, query })).ok, true)
  const created = await call('fabric_project_scaffold', { projectPath: project, modId: 'iron_ticket', modName: 'Iron Ticket' }); assert.equal(created.project.valid, true)
  assert.equal((await call('fabric_project_inspect', { projectPath: project })).project.modId, 'iron_ticket')
  await cp(path.join(root, 'examples/iron-ticket/src'), path.join(project, 'src'), { recursive: true })
  assert.equal((await call('fabric_validate', { projectPath: project })).ok, true)
  const spec = JSON.parse(await readFile(path.join(root, 'examples/iron-ticket/test-spec.json'), 'utf8'))
  const absent = await call('minecraft_test_start', { spec }); assert.equal(absent.verdict, 'INCONCLUSIVE'); assert.equal(absent.code, 'ENVIRONMENT_UNAVAILABLE')
  const build = await call('fabric_build_start', { projectPath: project, task: 'build' }); jobs.push(build.jobId)
  const built = await settled(build.jobId); await save('build', built); assert.equal(built.result?.exitCode, 0, JSON.stringify(built))
  console.log(JSON.stringify({ step: 'mod-built', scope }))
  instance = await call('minecraft_run_client', { projectPath: project, gameDirectory: game }); jobs.push(instance.jobId)
  await poll(async () => { const value = await call('minecraft_runtime_status', { instanceId: instance.instanceId }); if (value.job.error || value.job.result) throw Error(JSON.stringify(value.job)); return value.bridgeReady })
  const inspect = async () => { const discovery = readBridgeDiscovery(game); assert.ok(discovery); const value = await bridgeRequest(discovery, 'GET', '/v1/inspect'); return { screen: value.data.screen, widgets: Array.isArray(value.data.widgets) ? value.data.widgets : value.data.widgets?.widgets || [] } }
  const input = async (action, args) => { const value = await call('minecraft_input', { instanceId: instance.instanceId, action, args }); assert.equal(value.ok, true) }
  await poll(async () => (await inspect()).screen?.className?.includes('TitleScreen'))
  await input('click_widget', { label: '单人游戏' }); await poll(async () => (await inspect()).screen?.className?.includes('SelectWorldScreen'))
  await selectBenchWorld(inspect, input, (work, label) => poll(work, label, 30000))
  await poll(async () => (await call('minecraft_snapshot', { instanceId: instance.instanceId })).data.worldName === 'ModCrafting Test World')
  await poll(async () => { const { screen } = await inspect(); return screen?.kind === 'ingame' && !screen.className }, 'ready Minecraft controls')
  for (const [id, modify, verdict] of [
    ['no_use_control', (value) => { value.actions = [{ type: 'wait', ms: 500 }]; value.assertions = [value.assertions[0]] }, 'FAIL'],
    ['use_once', () => {}, 'PASS'],
    ['wrong_reward_expectation', (value) => { value.assertions[0].countAtLeast = 2 }, 'FAIL'],
    ['use_once_repeat', () => {}, 'PASS']
  ]) {
    const value = structuredClone(spec); value.id = 'first_use_' + id; modify(value)
    const started = await call('minecraft_test_start', { instanceId: instance.instanceId, spec: value }); jobs.push(started.jobId)
    const job = await settled(started.jobId); await save(id, job); assert.equal(job.result.cleanup.failed, false)
    summary.cases.push({ id, verdict: job.result.verdict, expected: verdict, cleanup: job.result.cleanup, reportPath: job.result.reportPath }); console.log(JSON.stringify({ step: 'mod-case', id, verdict: job.result.verdict, expected: verdict }))
  }
  assert.ok(summary.cases.every((value) => value.verdict === value.expected), JSON.stringify(summary.cases))
  const url = new URL(environment.browserUrl), token = new URLSearchParams(url.hash.slice(1)).get('token')
  const visible = await (await fetch(url.origin + '/api/state', { headers: { authorization: `Bearer ${token}` } })).json(); assert.equal(visible.jobs.length, jobs.length)
  await mkdir(path.join(scope, 'export')); const jar = path.join(scope, 'export/iron_ticket-0.1.0.jar'); await copyFile(path.join(project, 'build/libs/iron_ticket-0.1.0.jar'), jar)
  await copyFile(path.join(product, 'plugin/LICENSE'), path.join(scope, 'export/LICENSE'))
  summary.export = jar; summary.browserSameJobs = true; summary.missingBridgeDiagnosed = true; summary.ok = true
} catch (error) { summary.error = String(error); throw error }
finally {
  for (const jobId of jobs) await call('fabric_job_stop', { jobId }).catch(() => {})
  if (instance) await settled(instance.jobId).catch(() => {})
  await client.close().catch(() => {}); summary.serverExit = await transport.exit
  // Omit private URL fragments and discovery/image payloads from the trace.
  await save('tool-trace', trace.map((row) => ({ ...row, result: row.name === 'modcrafting_environment_status' ? { ...row.result, browserUrl: row.result.browserUrl ? new URL(row.result.browserUrl).origin : undefined } : row.result })))
  const after = await Promise.all([product, assets, worldInput].map(hashTree)); summary.inputsUnchanged = after.every((value, index) => JSON.stringify(value) === JSON.stringify(before[index]))
  await save('acceptance', summary); console.log(JSON.stringify(summary))
}
