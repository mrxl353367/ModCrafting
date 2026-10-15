import assert from 'node:assert/strict'
import test from 'node:test'
import { spawn } from 'node:child_process'
import { createServer, request as httpRequest } from 'node:http'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { FabricRuntime, createRuntimePaths, FABRIC_TARGET, GAME_TEST_WORLD, validateGameTestSpec, type GameTestSpec, type JobSnapshot } from '../../packages/modcrafting-core/src/index.ts'
import { startBrowserView } from '../../plugins/modcrafting-fabric/src/browser-server.ts'

const assets = { html: '<!doctype html><title>fixture view</title>', js: '/* fixture */', css: 'body{color:white}' }
async function fixture(t: { after: (work: () => Promise<void>) => void }) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'modcrafting-view-'))
  const project = path.join(root, 'project'); await mkdir(project)
  const children: Promise<void>[] = []
  const runtime = new FabricRuntime({ paths: createRuntimePaths(path.join(root, 'data')), version: 'browser-fixture', toolchain: {
    status: async () => ({ ok: true, platform: process.platform, node: process.version, java: { ok: true }, gradleWrapper: true, target: FABRIC_TARGET, remediation: [] }),
    startGradle: async (_, task, events) => {
      const child = spawn(process.execPath, ['-e', task === 'runClient' ? 'setInterval(()=>{},1000)' : "console.log('VIEW_FIXTURE_BUILD');setTimeout(()=>process.exit(0),300)"], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
      child.stdout.on('data', (part) => events?.onLog?.('fixture', String(part)))
      children.push(new Promise((resolve) => child.once('close', () => resolve())))
      return child
    }
  } })
  const view = await startBrowserView(runtime, assets)
  t.after(async () => { runtime.close(); await Promise.all(children); await view.close() })
  const url = new URL(view.url), token = new URLSearchParams(url.hash.slice(1)).get('token')!
  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
  const call = async (body: unknown) => (await fetch(url.origin + '/api/action', { method: 'POST', headers, body: JSON.stringify(body) })).json()
  const state = async () => (await fetch(url.origin + '/api/state', { headers })).json()
  return { root, project, runtime, url, headers, view, call, state }
}
async function settled(runtime: FabricRuntime, id: string): Promise<JobSnapshot> {
  const deadline = Date.now() + 5000
  while (Date.now() < deadline) { const job = runtime.jobStatus(id); assert.ok('status' in job); if (job.result || job.error) return job; await new Promise((resolve) => setTimeout(resolve, 15)) }
  throw Error('Fixture job did not settle')
}
test('Browser view uses loopback, authenticates APIs and rejects cross-site/rebinding requests', async (t) => {
  const f = await fixture(t)
  const page = await fetch(f.url.origin)
  assert.equal(page.status, 200); assert.match(page.headers.get('content-security-policy')!, /frame-ancestors 'none'/)
  assert.equal(page.headers.get('cache-control'), 'no-store')
  assert.equal((await fetch(f.url.origin + '/api/state')).status, 401)
  assert.equal((await fetch(f.url.origin + '/api/state', { headers: { ...f.headers, origin: 'https://outside.example' } })).status, 403)
  assert.equal((await fetch(f.url.origin + '/api/state', { headers: { ...f.headers, 'sec-fetch-site': 'cross-site' } })).status, 403)
  const rebinding = await new Promise<number>((resolve, reject) => { const request = httpRequest(f.url.origin + '/api/state', { headers: { ...f.headers, host: 'outside.example' } }, (reply) => { reply.resume(); resolve(reply.statusCode!) }); request.once('error', reject); request.end() })
  assert.equal(rebinding, 403)
  assert.equal((await fetch(f.url.origin + '/api/action', { method: 'POST', headers: f.headers, body: '{' })).status, 400)
  assert.equal((await fetch(f.url.origin + '/api/action', { method: 'POST', headers: f.headers, body: 'x'.repeat(256 * 1024 + 1) })).status, 413)
  assert.equal((await f.call({ operation: 'command', command: 'unsafe' })).code, 'INVALID_ARGUMENT')
  assert.equal((await f.call({ operation: 'build', projectPath: f.project, task: 'build & anything' })).code, 'INVALID_ARGUMENT')
  assert.equal((await f.call({ operation: 'project', projectPath: path.join(f.root, 'missing') })).code, 'PROJECT_UNAVAILABLE')
  assert.equal((await f.state()).jobs.length, 0)
})
test('Browser and Core share jobs in both directions; closing view leaves a running build intact', async (t) => {
  const f = await fixture(t), first = f.runtime.startBuild(f.project)
  assert.equal((await f.state()).jobs[0].id, first.jobId)
  assert.equal((await f.call({ operation: 'stop', jobId: first.jobId })).ok, true)
  assert.equal((await settled(f.runtime, first.jobId)).status, 'stopped')
  const second = await f.call({ operation: 'build', projectPath: f.project })
  assert.equal(f.runtime.state().jobs.at(-1)?.id, second.jobId)
  await f.view.close()
  assert.equal((await settled(f.runtime, second.jobId)).status, 'completed')
  assert.equal((f.runtime.jobStatus(second.jobId) as JobSnapshot).result?.exitCode, 0)
})
test('Browser exposes real Core verdicts/reports and bridge images; no arbitrary report/file read', async (t) => {
  const f = await fixture(t)
  await mkdir(path.join(f.runtime.paths.assetsRoot, 'base-mods'), { recursive: true })
  await writeFile(path.join(f.runtime.paths.assetsRoot, 'base-mods/modcrafting-observer.jar'), 'Fixture only')
  const gameDir = path.join(f.root, 'game'), client = f.runtime.runClient(f.project, gameDir)
  let sequence = 0
  const observer = createServer((req, res) => {
    req.resume(); res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(req.url === '/v2/capabilities' ? { ok: true, protocolVersion: 2 }
      : req.url === '/v1/screenshot' ? { ok: true, base64: 'aGVsbG8=', path: 'do-not-read-this-file' }
      : { ok: true, worldName: GAME_TEST_WORLD, requestId: `fixture_${++sequence}`, observedAt: Date.now(), player: { health: 20 } }))
  })
  await new Promise<void>((resolve) => observer.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise<void>((resolve) => observer.close(() => resolve())))
  await writeFile(path.join(gameDir, 'modcrafting-bridge.json'), JSON.stringify({ port: (observer.address() as { port: number }).port, token: 'fixture-token' }))
  const instanceId = client.instanceId
  assert.equal((await f.call({ operation: 'runtime', instanceId })).bridgeReady, true)
  assert.equal((await f.call({ operation: 'snapshot', instanceId })).data.worldName, GAME_TEST_WORLD)
  assert.equal((await f.call({ operation: 'screenshot', instanceId })).image, 'data:image/png;base64,aGVsbG8=')
  for (const [id, assertion, verdict] of [
    ['view-pass', { type: 'snapshot_value', source: 'player', pointer: '/health', equals: 20 }, 'PASS'],
    ['view-fail', { type: 'snapshot_value', source: 'player', pointer: '/health', equals: -1 }, 'FAIL'],
    ['view-unsupported', { type: 'hud_text', text: 'unknown' }, 'INCONCLUSIVE']
  ] as const) {
    const spec: GameTestSpec = { version: 2, id, featureType: 'player_interaction', subject: {}, setup: [], actions: [{ type: 'wait', ms: 10 }], assertions: [assertion], cleanup: [] }
    assert.equal(validateGameTestSpec(spec).ok, true)
    const started = await f.call({ operation: 'test', instanceId, spec })
    const job = await settled(f.runtime, started.jobId)
    assert.equal(job.result?.verdict, verdict)
    const report = await (await fetch(f.url.origin + '/api/report/' + started.jobId, { headers: f.headers })).json()
    assert.equal(report.verdict, verdict); assert.equal(report.instanceId, instanceId)
    assert.equal((await f.state()).jobs.find((value: JobSnapshot) => value.id === job.id).result.verdict, verdict)
    job.result!.reportPath = path.join(f.root, 'private.json'); await writeFile(job.result!.reportPath as string, '{}')
    assert.equal((await (await fetch(f.url.origin + '/api/report/' + started.jobId, { headers: f.headers })).json()).code, 'REPORT_UNAVAILABLE')
  }
  assert.equal((await f.call({ operation: 'test', instanceId, spec: {} })).code, 'INVALID_SPEC')
  assert.equal((await f.call({ operation: 'stop', jobId: 'not-owned' })).code, 'JOB_NOT_FOUND')
  await f.call({ operation: 'stop', jobId: client.jobId }); await settled(f.runtime, client.jobId)
})
