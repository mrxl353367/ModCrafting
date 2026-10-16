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
  searchWiki, validateFabricProject, readProjectCatalog, recipeWorkspace, recipeRequestSchema, type ProjectWrapper
} from '../../../packages/modcrafting-core/src/index.ts'
import { startBrowserView, type BrowserAssets } from './browser-server.ts'

declare const __PLUGIN_VERSION__: string
declare const __WEB_ASSETS__: BrowserAssets
declare const __PROJECT_WRAPPER__: ProjectWrapper
const configuredData = process.env.MODCRAFTING_DATA ?? process.env.PLUGIN_DATA ?? process.env.CODEX_PLUGIN_DATA
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
const runtime = new FabricRuntime({ paths, version: __PLUGIN_VERSION__ })
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
  server.registerTool('fabric_gui_workspace', { description: 'Get templates and list/read declarative Screen, configuration and HUD layouts; preview generated Fabric client files before save. Save requires expectedRevision and previewRevision. Unknown or externally modified Java stays read-only; display slots do not implement server containers.', inputSchema: guiRequestSchema }, async request => { try { return result(guiWorkspace(paths, request)) } catch (cause) { return failure(cause) } })
  server.registerTool('fabric_content_workspace', { description: 'List/read supported declarative item, food, block, entity, tool and armor parameters. Preview changes before save; save requires matching expectedRevision and previewRevision. Handwritten or externally modified generated sources remain read-only.', inputSchema: contentRequestSchema }, async (request) => { try { return result(contentWorkspace(runtime.paths, request)) } catch (cause) { return failure(cause) } })
  server.registerTool('fabric_recipe_workspace', { description: 'List/read Fabric 1.21.4 recipes, search the vanilla/project item catalog, or save a validated recipe using expectedRevision from the last read (null only for new files). Shared with the visual recipe editor; refuses external-edit conflicts and unsupported formats.', inputSchema: recipeRequestSchema }, async (request) => { try { return result(recipeWorkspace(paths, request)) } catch (cause) { return failure(cause) } })
  server.registerTool('modcrafting_environment_status', { description: 'Check the Windows, JDK 21, Gradle Wrapper and Fabric 1.21.4 prerequisites without changing the system.', inputSchema: z.object({ projectPath: z.string().optional() }) }, async ({ projectPath: value }) => { try { return result({ ...await runtime.environmentStatus(value), projectCatalog: readProjectCatalog(paths.dataRoot), ...(browser ? { browserUrl: browser.url } : {}) }) } catch (cause) { return failure(cause) } })
  server.registerTool('modcrafting_prepare_assets', { description: 'Download ModCrafting knowledge and test assets to the plugin data directory. Uses gh.xmly.dev first, then GitHub direct.', inputSchema: z.object({}) }, async () => { try { return result(await runtime.prepareAssets()) } catch (cause) { return failure(cause) } })
  server.registerTool('minecraft_data_lookup', { description: 'Look up standard Minecraft block, item, entity, enchantment, or recipe data before writing Fabric registration code.', inputSchema: z.object({ kind: z.enum(['block', 'item', 'entity', 'enchantment', 'recipe']), query: z.string().min(1) }) }, async ({ kind, query }) => result(lookupMinecraftData(paths, kind, query)))
  server.registerTool('fabric_docs_search', { description: 'Search downloaded Fabric documentation by keyword.', inputSchema: z.object({ query: z.string().min(1), limit: z.number().int().min(1).max(20).default(8) }) }, async ({ query, limit }) => result(searchFabricDocs(paths, query, limit)))
  server.registerTool('mc_wiki_search', { description: 'Search the downloaded Chinese Minecraft knowledge index.', inputSchema: z.object({ query: z.string().min(1), limit: z.number().int().min(1).max(20).default(8) }) }, async ({ query, limit }) => result(searchWiki(paths, query, limit)))
  server.registerTool('fabric_project_inspect', { description: 'Inspect a Fabric project without modifying it.', inputSchema: z.object({ projectPath: z.string().min(1) }) }, async ({ projectPath: value }) => { try { return result({ ok: true, project: inspectFabricProject(resolveProjectPath(value)) }) } catch (cause) { return failure(cause) } })
  server.registerTool('fabric_project_scaffold', { description: 'Create an empty Fabric 1.21.4 project with the pinned Gradle Wrapper. The destination must not already contain files; the first build may download Gradle and dependencies.', inputSchema: z.object({ projectPath: z.string().min(1), modId: z.string().min(2), modName: z.string().min(1) }) }, async ({ projectPath: value, modId, modName }) => { try { return result({ ok: true, project: await scaffoldFabricProject(value, modId, modName, __PROJECT_WRAPPER__) }) } catch (cause) { return failure(cause) } })
  server.registerTool('fabric_validate', { description: 'Validate Fabric metadata, Gradle Wrapper and Minecraft version constraints.', inputSchema: z.object({ projectPath: z.string().min(1) }) }, async ({ projectPath: value }) => { try { return result(validateFabricProject(resolveProjectPath(value))) } catch (cause) { return failure(cause) } })
  server.registerTool('fabric_build_start', { description: 'Start a Gradle build, test, datagen, or other explicitly requested task asynchronously.', inputSchema: z.object({ projectPath: z.string().min(1), task: z.string().regex(/^[A-Za-z][A-Za-z0-9:.-]*$/).default('build') }) }, async ({ projectPath: value, task }) => { try { return result(runtime.startBuild(value, task)) } catch (cause) { return failure(cause) } })
  server.registerTool('fabric_job_status', { description: 'Read the current state and recent output of a build, game, or test job.', inputSchema: z.object({ jobId: z.string().min(1) }) }, async ({ jobId }) => result(runtime.jobStatus(jobId)))
  server.registerTool('fabric_job_stop', { description: 'Stop a plugin-owned long-running Gradle, Minecraft, or test job.', inputSchema: z.object({ jobId: z.string().min(1) }) }, async ({ jobId }) => result(runtime.stopJob(jobId)))
  server.registerTool('minecraft_run_client', { description: 'Start runClient through the project Gradle Wrapper. This requires system JDK 21, prepared base mods, and does not download a toolchain.', inputSchema: z.object({ projectPath: z.string().min(1), gameDirectory: z.string().optional() }) }, async ({ projectPath: value, gameDirectory }) => { try { return result(runtime.runClient(value, gameDirectory)) } catch (cause) { return failure(cause) } })
  server.registerTool('minecraft_runtime_status', { description: 'Read Minecraft job status and Observer V2 readiness.', inputSchema: z.object({ instanceId: z.string().optional() }) }, async ({ instanceId }) => { try { return result(await runtime.runtimeStatus(instanceId)) } catch (cause) { return failure(cause) } })
  server.registerTool('minecraft_stop_client', { description: 'Stop the selected plugin-owned Minecraft client.', inputSchema: z.object({ instanceId: z.string().optional() }) }, async ({ instanceId }) => { try { return result(runtime.stopClient(instanceId)) } catch (cause) { return failure(cause) } })
  server.registerTool('minecraft_snapshot', { description: 'Collect an Observer V2 snapshot from a running Minecraft client.', inputSchema: z.object({ instanceId: z.string().optional() }) }, async ({ instanceId }) => { try { return result(await runtime.snapshot(instanceId)) } catch (cause) { return failure(cause) } })
  server.registerTool('minecraft_command', { description: 'Run a Minecraft command through Observer V2 and return its structured result.', inputSchema: z.object({ command: z.string().min(1), instanceId: z.string().optional() }) }, async ({ command, instanceId }) => { try { return result(await runtime.command(command, instanceId)) } catch (cause) { return failure(cause) } })
  server.registerTool('minecraft_input', { description: 'Send controlled client input through the local Observer bridge.', inputSchema: z.object({ action: z.string().min(1), args: z.record(z.string(), z.unknown()).optional(), instanceId: z.string().optional() }) }, async ({ action, args, instanceId }) => { try { return result(await runtime.input(action, args, instanceId)) } catch (cause) { return failure(cause) } })
  server.registerTool('minecraft_test_start', { description: 'Run a V2 deterministic game test asynchronously. Missing evidence and unsupported assertions are INCONCLUSIVE; only the dedicated test world is allowed.', inputSchema: z.object({ spec: z.unknown(), instanceId: z.string().optional() }) }, async ({ spec: raw, instanceId }) => {
    try { return result(runtime.startTest(raw, instanceId)) }
    catch (cause) {
      if (cause instanceof CoreError && cause.code === 'INVALID_SPEC') return failure(cause)
      return error('Minecraft instance or Observer is unavailable', { code: 'ENVIRONMENT_UNAVAILABLE', verdict: 'INCONCLUSIVE' })
    }
  })
  server.registerTool('minecraft_test_status', { description: 'Read a deterministic Minecraft test job and its report result.', inputSchema: z.object({ jobId: z.string().min(1) }) }, async ({ jobId }) => result(runtime.jobStatus(jobId)))
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
