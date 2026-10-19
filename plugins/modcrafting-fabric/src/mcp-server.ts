#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/server'
import { serveStdio } from '@modelcontextprotocol/server/stdio'
import { z } from 'zod'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import {
  FabricRuntime, CoreError, guiWorkspace, guiRequestSchema, createRuntimePaths, ensureRuntimePaths, resolveProjectPath,
  inspectFabricProject, lookupMinecraftData, scaffoldFabricProject, searchFabricDocs, contentWorkspace, contentRequestSchema,
  searchWiki, validateFabricProject, recipeWorkspace, recipeRequestSchema, gameTestSpecSchema, gameTestTemplate,
  testProfileSchema, type GameFeatureType, type ProjectWrapper
} from '../../../packages/modcrafting-core/src/index.ts'
import { startBrowserView, type BrowserAssets } from './browser-server.ts'
import { openWorkbench } from './workbench.ts'
import type { BundledObserver } from '../../../packages/modcrafting-core/src/runtime.ts'

declare const __PLUGIN_VERSION__: string
declare const __WEB_ASSETS__: BrowserAssets
declare const __PROJECT_WRAPPER__: ProjectWrapper
declare const __OBSERVER__: BundledObserver | undefined
const configuredData = process.env.MODCRAFTING_DATA ?? process.env.QODER_PLUGIN_DATA ?? process.env.PLUGIN_DATA ?? process.env.CODEX_PLUGIN_DATA
if (configuredData !== undefined && (!configuredData.trim() || !path.isAbsolute(configuredData))) {
  throw new Error('INVALID_DATA_DIRECTORY: use an absolute writable MODCRAFTING_DATA / PLUGIN_DATA / CODEX_PLUGIN_DATA directory')
}
const dataRoot = configuredData ?? path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'ModCrafting', 'fabric-plugin')
const paths = createRuntimePaths(dataRoot)
try {
  ensureRuntimePaths(paths)
  const probe = path.join(paths.dataRoot, `.write-check-${process.pid}`)
  fs.writeFileSync(probe, '', { flag: 'wx' }); fs.unlinkSync(probe)
} catch { throw new Error('INVALID_DATA_DIRECTORY: plugin data directory is not writable') }
const runtime = new FabricRuntime({ paths, version: __PLUGIN_VERSION__, observer: __OBSERVER__, scaffoldIncludesWrapper: true })
const browserEnabled = process.argv.includes('--web') || process.argv.includes('--web-only')
const portArgument = process.argv.find((value) => value.startsWith('--web-port='))
if (portArgument && !browserEnabled) throw Error('Use --web with --web-port')
const browser = browserEnabled ? await startBrowserView(runtime, __WEB_ASSETS__, portArgument ? Number(portArgument.split('=')[1]) : 0) : undefined
if (browser) process.stderr.write(`ModCrafting browser: ${browser.url}\n`)

function result(value: Record<string, unknown>) { return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }], structuredContent: value } }
function error(message: string, extra: Record<string, unknown> = {}) { return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, error: message, ...extra }, null, 2) }], isError: true } }
function failure(cause: unknown) { return error(String(cause), { code: cause instanceof CoreError ? cause.code : 'OPERATION_FAILED' }) }

function buildServer(): McpServer {
  ensureRuntimePaths(paths)
  const server = new McpServer({ name: 'modcrafting-fabric', version: __PLUGIN_VERSION__ })
  server.registerTool('modcrafting_session', { description: 'Create or manage an isolated task session. Create once at the start of a task, then pass its returned sessionId to every build, game, test, status, stop, and workbench call. Resume before continuing an old session; ending it stops only its jobs and preserves reports.', inputSchema: z.object({ action: z.enum(['create', 'read', 'resume', 'update', 'end']), sessionId: z.string().optional(), name: z.string().optional(), projectPath: z.string().optional(), phase: z.string().optional(), currentModule: z.enum(['overview', 'content', 'recipe', 'gui', 'build', 'game', 'tests', 'reports']).optional(), recommendedModules: z.array(z.enum(['overview', 'content', 'recipe', 'gui', 'build', 'game', 'tests', 'reports'])).optional() }) }, async (request) => {
    try {
      if (request.action === 'create') return result({ ok: true, session: runtime.createSession({ name: request.name, projectPath: request.projectPath }) })
      if (!request.sessionId) throw new CoreError('SESSION_REQUIRED', '除 create 外都需要 sessionId。')
      if (request.action === 'read') return result({ ok: true, session: runtime.readSession(request.sessionId) })
      if (request.action === 'resume') return result({ ok: true, session: runtime.resumeSession(request.sessionId) })
      if (request.action === 'end') return result({ ok: true, session: runtime.endSession(request.sessionId) })
      const { action: _action, sessionId, ...changes } = request
      return result({ ok: true, session: runtime.updateSession(sessionId, changes) })
    } catch (cause) { return failure(cause) }
  })
  server.registerTool('modcrafting_test_profile', { description: 'Read or update the game settings for one task session. Session changes take effect at the next Minecraft launch. Saving as the project default is explicit and writes .modcrafting/test-profile.json.', inputSchema: z.object({ action: z.enum(['read', 'write']), sessionId: z.string().uuid(), projectPath: z.string().optional(), profile: testProfileSchema.optional(), saveAsProjectDefault: z.boolean().default(false) }) }, async (request) => {
    try {
      if (request.action === 'read') return result({ ok: true, sessionId: request.sessionId, profile: runtime.getTestProfile(request.sessionId, request.projectPath) })
      if (!request.profile) throw new CoreError('PROFILE_REQUIRED', '写入配置时需要完整 profile。')
      return result(runtime.setTestProfile(request.sessionId, request.profile, { projectPath: request.projectPath, saveAsProjectDefault: request.saveAsProjectDefault }))
    } catch (cause) { return failure(cause) }
  })
  server.registerTool('minecraft_test_template', { description: 'Return a valid GameTestSpec v2 starting template. Edit this object rather than guessing fields; unsupported assertions remain explicitly reported as inconclusive.', inputSchema: z.object({ featureType: z.enum(['new_item', 'new_block', 'new_recipe', 'entity_behavior', 'player_interaction', 'hud_gui']).default('new_item') }) }, async ({ featureType }) => result({ ok: true, spec: gameTestTemplate(featureType as GameFeatureType), schema: gameTestSpecSchema.toJSONSchema() }))
  server.registerTool('modcrafting_open_workbench', { description: 'Open the visual workbench for this task session. Pass sessionId and the current project; the workbench shows only that session. Returns a link if automatic opening does not work.', inputSchema: z.object({ sessionId: z.string().optional(), projectPath: z.string().optional(), view: z.enum(['overview', 'content', 'recipe', 'gui', 'build', 'game', 'tests', 'reports']).default('overview'), open: z.boolean().default(true) }) }, async (request) => {
    try {
      const projectPath = request.projectPath ? resolveProjectPath(request.projectPath) : undefined
      const sessionId = request.sessionId || runtime.createSession({ name: '可视化任务', projectPath }).sessionId
      if (request.sessionId) runtime.resumeSession(sessionId)
      runtime.updateSession(sessionId, { ...(projectPath ? { projectPath } : {}), currentModule: request.view, recommendedModules: [request.view] })
      return result(await openWorkbench(browser?.url, { ...request, sessionId, backendId: runtime.state(sessionId).backendId }))
    } catch (cause) { return failure(cause) }
  })
  server.registerTool('fabric_gui_workspace', { description: 'Get templates and list/read declarative Screen, configuration and HUD layouts; preview generated Fabric client files before save. Save requires expectedRevision and previewRevision. Unknown or externally modified Java stays read-only; display slots do not implement server containers.', inputSchema: guiRequestSchema }, async request => { try { return result(guiWorkspace(paths, request)) } catch (cause) { return failure(cause) } })
  server.registerTool('fabric_content_workspace', { description: 'List/read supported declarative item, food, block, entity, tool and armor parameters. Preview changes before save; save requires matching expectedRevision and previewRevision. Handwritten or externally modified generated sources remain read-only.', inputSchema: contentRequestSchema }, async (request) => { try { return result(contentWorkspace(runtime.paths, request)) } catch (cause) { return failure(cause) } })
  server.registerTool('fabric_recipe_workspace', { description: 'List/read Fabric 1.21.4 recipes, search the vanilla/project item catalog, or save a validated recipe using expectedRevision from the last read (null only for new files). Shared with the visual recipe editor; refuses external-edit conflicts and unsupported formats.', inputSchema: recipeRequestSchema }, async (request) => { try { return result(recipeWorkspace(paths, request)) } catch (cause) { return failure(cause) } })
  server.registerTool('modcrafting_environment_status', { description: 'Check project, Java, cache paths and resource compatibility without downloads. An empty folder is a new-project state, not a broken installation. Explain results in plain language; use modcrafting_open_workbench for browser opening.', inputSchema: z.object({ projectPath: z.string().optional() }) }, async ({ projectPath: value }) => { try { return result({ ...await runtime.environmentStatus(value), version: __PLUGIN_VERSION__, projectState: value ? inspectFabricProject(value).valid ? 'existing_project' : 'needs_project' : 'no_project_selected', observer: { bundled: Boolean(__OBSERVER__), version: __OBSERVER__?.version, protocol: __OBSERVER__?.protocol }, ...(browser ? { browserUrl: browser.url, browser: { available: true, opened: false } } : {}) }) } catch (cause) { return failure(cause) } })
  server.registerTool('modcrafting_prepare_assets', { description: 'Prepare missing knowledge resources in the configured data directory. Choose only the names needed; healthy resources are reused. The matching game-test component is bundled and never replaced by old release downloads.', inputSchema: z.object({ names: z.array(z.enum(['minecraft-data', 'mc-wiki-zh', 'mc-wiki-zh-index', 'agent-knowledge'])).min(1).optional() }) }, async ({ names }) => { try { return result(await runtime.prepareAssets(names)) } catch (cause) { return failure(cause) } })
  server.registerTool('minecraft_data_lookup', { description: 'Look up standard Minecraft block, item, entity, enchantment, or recipe data before writing Fabric registration code.', inputSchema: z.object({ kind: z.enum(['block', 'item', 'entity', 'enchantment', 'recipe']), query: z.string().min(1) }) }, async ({ kind, query }) => result(lookupMinecraftData(paths, kind, query)))
  server.registerTool('fabric_docs_search', { description: 'Search downloaded Fabric documentation by keyword.', inputSchema: z.object({ query: z.string().min(1), limit: z.number().int().min(1).max(20).default(8) }) }, async ({ query, limit }) => result(searchFabricDocs(paths, query, limit)))
  server.registerTool('mc_wiki_search', { description: 'Search the downloaded Chinese Minecraft knowledge index.', inputSchema: z.object({ query: z.string().min(1), limit: z.number().int().min(1).max(20).default(8) }) }, async ({ query, limit }) => result(searchWiki(paths, query, limit)))
  server.registerTool('fabric_project_inspect', { description: 'Inspect a Fabric project without modifying it.', inputSchema: z.object({ projectPath: z.string().min(1) }) }, async ({ projectPath: value }) => { try { return result({ ok: true, project: inspectFabricProject(resolveProjectPath(value)) }) } catch (cause) { return failure(cause) } })
  server.registerTool('fabric_project_scaffold', { description: 'Create an empty Fabric 1.21.4 project with the pinned Gradle Wrapper. The destination must not already contain files; the first build may download Gradle and dependencies.', inputSchema: z.object({ projectPath: z.string().min(1), modId: z.string().min(2), modName: z.string().min(1) }) }, async ({ projectPath: value, modId, modName }) => { try { return result({ ok: true, project: await scaffoldFabricProject(value, modId, modName, __PROJECT_WRAPPER__) }) } catch (cause) { return failure(cause) } })
  server.registerTool('fabric_validate', { description: 'Validate Fabric metadata, Gradle Wrapper and Minecraft version constraints.', inputSchema: z.object({ projectPath: z.string().min(1) }) }, async ({ projectPath: value }) => { try { return result(validateFabricProject(resolveProjectPath(value))) } catch (cause) { return failure(cause) } })
  server.registerTool('fabric_build_start', { description: 'Start one project build asynchronously. Builds for the same project run in order. Required: task sessionId.', inputSchema: z.object({ sessionId: z.string().uuid(), projectPath: z.string().min(1), task: z.string().regex(/^[A-Za-z][A-Za-z0-9:.-]*$/).default('build') }) }, async ({ sessionId, projectPath: value, task }) => { try { return result(runtime.startBuild(value, task, sessionId)) } catch (cause) { return failure(cause) } })
  server.registerTool('fabric_job_status', { description: 'Read only a job owned by this task session.', inputSchema: z.object({ sessionId: z.string().uuid(), jobId: z.string().min(1) }) }, async ({ sessionId, jobId }) => result(runtime.jobStatus(jobId, sessionId)))
  server.registerTool('fabric_job_stop', { description: 'Stop only a long-running job owned by this task session.', inputSchema: z.object({ sessionId: z.string().uuid(), jobId: z.string().min(1) }) }, async ({ sessionId, jobId }) => result(runtime.stopJob(jobId, sessionId)))
  server.registerTool('minecraft_run_client', { description: 'Start Minecraft in this task session and return a preparation job. Wait for canRunTests=true before testing. The profile is snapshotted at launch; requires system JDK 21.', inputSchema: z.object({ sessionId: z.string().uuid(), projectPath: z.string().min(1), gameDirectory: z.string().optional(), profile: testProfileSchema.optional() }) }, async ({ sessionId, projectPath: value, gameDirectory, profile }) => { try { return result(runtime.runClient(value, gameDirectory, sessionId, profile)) } catch (cause) { return failure(cause) } })
  server.registerTool('minecraft_runtime_status', { description: 'Read this session’s Minecraft preparation stage, blockers, bridge readiness, and canRunTests flag.', inputSchema: z.object({ sessionId: z.string().uuid(), instanceId: z.string().optional() }) }, async ({ sessionId, instanceId }) => { try { return result(await runtime.runtimeStatus(instanceId, sessionId)) } catch (cause) { return failure(cause) } })
  server.registerTool('minecraft_stop_client', { description: 'Stop the selected client only if it belongs to this task session.', inputSchema: z.object({ sessionId: z.string().uuid(), instanceId: z.string().optional() }) }, async ({ sessionId, instanceId }) => { try { return result(runtime.stopClient(instanceId, sessionId)) } catch (cause) { return failure(cause) } })
  server.registerTool('minecraft_snapshot', { description: 'Collect an Observer V2 snapshot from this session’s ready Minecraft client.', inputSchema: z.object({ sessionId: z.string().uuid(), instanceId: z.string().optional() }) }, async ({ sessionId, instanceId }) => { try { return result(await runtime.snapshot(instanceId, undefined, sessionId)) } catch (cause) { return failure(cause) } })
  server.registerTool('minecraft_command', { description: 'Run a Minecraft command through the Observer in this task session.', inputSchema: z.object({ sessionId: z.string().uuid(), command: z.string().min(1), instanceId: z.string().optional() }) }, async ({ sessionId, command, instanceId }) => { try { return result(await runtime.command(command, instanceId, sessionId)) } catch (cause) { return failure(cause) } })
  server.registerTool('minecraft_input', { description: 'Send controlled client input through this session’s local Observer bridge.', inputSchema: z.object({ sessionId: z.string().uuid(), action: z.string().min(1), args: z.record(z.string(), z.unknown()).optional(), instanceId: z.string().optional() }) }, async ({ sessionId, action, args, instanceId }) => { try { return result(await runtime.input(action, args, instanceId, sessionId)) } catch (cause) { return failure(cause) } })
  server.registerTool('minecraft_test_start', { description: 'Run a typed V2 deterministic game test. The job waits for the session-owned test world; unsupported assertions stay INCONCLUSIVE.', inputSchema: z.object({ sessionId: z.string().uuid(), spec: gameTestSpecSchema, instanceId: z.string().optional() }) }, async ({ sessionId, spec: raw, instanceId }) => {
    try { return result(runtime.startTest(raw, instanceId, sessionId)) }
    catch (cause) {
      if (cause instanceof CoreError && cause.code === 'INVALID_SPEC') return failure(cause)
      return error('Minecraft instance or Observer is unavailable', { code: 'ENVIRONMENT_UNAVAILABLE', verdict: 'INCONCLUSIVE' })
    }
  })
  server.registerTool('minecraft_test_status', { description: 'Read a deterministic Minecraft test job and report owned by this session.', inputSchema: z.object({ sessionId: z.string().uuid(), jobId: z.string().min(1) }) }, async ({ sessionId, jobId }) => result(runtime.jobStatus(jobId, sessionId)))
  return server
}

if (process.argv.includes('--self-test')) {
  const server = buildServer()
  console.log(JSON.stringify({ ok: true, name: 'modcrafting-fabric', version: __PLUGIN_VERSION__, registrationOnly: true, server: Boolean(server) }))
  await browser?.close()
} else if (process.argv.includes('--web-only')) {
  const close = () => { runtime.close(); void browser?.close() }
  process.once('SIGINT', close); process.once('SIGTERM', close)
} else {
  const handle = serveStdio(() => buildServer())
  const close = () => { runtime.close(); void browser?.close(); void handle.close() }
  process.once('SIGINT', close); process.once('SIGTERM', close); process.stdin.once('end', close)
}
