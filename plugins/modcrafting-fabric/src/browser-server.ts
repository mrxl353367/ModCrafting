import { createServer } from 'node:http'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { readFile, realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { FabricRuntime, CoreError, inspectFabricProject, resolveProjectPath, readProjectCatalog } from '../../../packages/modcrafting-core/src/index.ts'

const projectPath = z.string().min(1), instanceId = z.string().min(1)
const actionSchema = z.discriminatedUnion('operation', [
  z.object({ operation: z.literal('project'), projectPath }).strict(),
  z.object({ operation: z.literal('environment'), projectPath: projectPath.optional() }).strict(),
  z.object({ operation: z.literal('prepare') }).strict(),
  z.object({ operation: z.literal('build'), projectPath, task: z.string().regex(/^[A-Za-z][A-Za-z0-9:.-]*$/).default('build') }).strict(),
  z.object({ operation: z.literal('run'), projectPath, gameDirectory: z.string().min(1).optional() }).strict(),
  z.object({ operation: z.literal('stop'), jobId: z.string().min(1) }).strict(),
  z.object({ operation: z.literal('runtime'), instanceId }).strict(),
  z.object({ operation: z.literal('snapshot'), instanceId }).strict(),
  z.object({ operation: z.literal('screenshot'), instanceId }).strict(),
  z.object({ operation: z.literal('test'), instanceId, spec: z.unknown() }).strict()
])
export type BrowserAction = z.input<typeof actionSchema>
export type BrowserAssets = { html: string; js: string; css: string }

/** Optional loopback view of an existing owner, never a second FabricRuntime. */
export async function startBrowserView(runtime: FabricRuntime, assets: BrowserAssets, port = 0) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw Error('INVALID_BROWSER_PORT')
  const token = randomBytes(32).toString('hex')
  let origin = ''
  const server = createServer(async (request, response) => {
    const json = (status: number, value: unknown) => { response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' }); response.end(JSON.stringify(value)) }
    response.setHeader('cache-control', 'no-store')
    response.setHeader('x-content-type-options', 'nosniff')
    response.setHeader('referrer-policy', 'no-referrer')
    response.setHeader('content-security-policy', "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
    // Host blocks DNS rebinding; Origin and Fetch Metadata block cross-site actions.
    if (request.headers.host !== origin.slice('http://'.length) || request.headers.origin && request.headers.origin !== origin || request.headers['sec-fetch-site'] === 'cross-site') {
      json(403, { ok: false, code: 'ORIGIN_FORBIDDEN', error: 'Use the local browser URL' }); return
    }
    const url = new URL(request.url || '/', origin)
    const publicAssets: Record<string, [string, string]> = { '/': ['text/html; charset=utf-8', assets.html], '/view.js': ['text/javascript; charset=utf-8', assets.js], '/view.css': ['text/css; charset=utf-8', assets.css] }
    if (request.method === 'GET' && publicAssets[url.pathname]) {
      const [type, contents] = publicAssets[url.pathname]; response.writeHead(200, { 'content-type': type }); response.end(contents); return
    }
    const supplied = Buffer.from((request.headers.authorization || '').replace(/^Bearer /, ''))
    const expected = Buffer.from(token)
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) { json(401, { ok: false, code: 'VIEW_AUTH_REQUIRED', error: 'Open the complete URL printed by the server' }); return }
    try {
      if (request.method === 'GET' && url.pathname === '/api/state') { json(200, runtime.state()); return }
      if (request.method === 'GET' && url.pathname === '/api/projects') { json(200, readProjectCatalog(runtime.paths.dataRoot)); return }
      if (request.method === 'GET' && url.pathname.startsWith('/api/report/')) {
        const job = runtime.jobStatus(decodeURIComponent(url.pathname.slice('/api/report/'.length)))
        if (!('result' in job) || typeof job.result?.reportPath !== 'string') throw new CoreError('REPORT_UNAVAILABLE', 'This job has no report')
        const root = await realpath(runtime.paths.reportsRoot), file = await realpath(job.result.reportPath)
        const relative = path.relative(root, file)
        if (relative.startsWith('..') || path.isAbsolute(relative) || !(await stat(file)).isFile()) throw new CoreError('REPORT_UNAVAILABLE', 'Report is outside the runtime report directory')
        json(200, JSON.parse(await readFile(file, 'utf8'))); return
      }
      if (request.method !== 'POST' || url.pathname !== '/api/action') { json(404, { ok: false, code: 'NOT_FOUND' }); return }
      if (!request.headers['content-type']?.startsWith('application/json')) { json(415, { ok: false, code: 'JSON_REQUIRED' }); return }
      const parts: Buffer[] = []; let length = 0
      for await (const part of request) {
        length += part.length
        if (length > 256 * 1024) { json(413, { ok: false, code: 'REQUEST_TOO_LARGE' }); return }
        parts.push(part)
      }
      const parsed = actionSchema.safeParse(JSON.parse(Buffer.concat(parts).toString('utf8')))
      if (!parsed.success) { json(400, { ok: false, code: 'INVALID_ARGUMENT', error: parsed.error.message }); return }
      const action = parsed.data
      let value: unknown
      switch (action.operation) {
        case 'project': value = { ok: true, project: inspectFabricProject(resolveProjectPath(action.projectPath)) }; break
        case 'environment': value = await runtime.environmentStatus(action.projectPath); break
        case 'prepare': value = await runtime.prepareAssets(); break
        case 'build': value = runtime.startBuild(action.projectPath, action.task); break
        case 'run': value = runtime.runClient(action.projectPath, action.gameDirectory); break
        case 'stop': value = runtime.stopJob(action.jobId); break
        case 'runtime': value = await runtime.runtimeStatus(action.instanceId); break
        case 'snapshot': value = await runtime.snapshot(action.instanceId); break
        case 'test': value = runtime.startTest(action.spec, action.instanceId); break
        case 'screenshot': {
          const result = await runtime.screenshot(action.instanceId)
          const base64 = result.data.base64
          // Serve bridge image data only; never read an arbitrary bridge-supplied file path.
          value = typeof base64 === 'string' && base64.length <= 16 * 1024 * 1024 && /^[A-Za-z0-9+/=\r\n]+$/.test(base64)
            ? { ok: result.ok, image: `data:image/png;base64,${base64}`, path: result.data.path }
            : { ok: false, code: 'SCREENSHOT_UNAVAILABLE', error: result.error || 'Observer did not return image data' }
          break
        }
      }
      json(200, value)
    } catch (cause) {
      json(cause instanceof SyntaxError ? 400 : 200, { ok: false, code: cause instanceof CoreError ? cause.code : cause instanceof SyntaxError ? 'INVALID_JSON' : 'OPERATION_FAILED', error: String(cause) })
    }
  })
  server.requestTimeout = 30000
  server.headersTimeout = 10000
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve) })
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  let closing: Promise<void> | undefined
  return {
    url: `${origin}/#token=${token}`,
    close: () => closing ??= new Promise<void>((resolve, reject) => { server.close((error) => error ? reject(error) : resolve()); server.closeIdleConnections() })
  }
}
