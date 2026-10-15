import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { inspectFabricProject } from './node.ts'

const catalogName = 'projects.json', markerName = 'desktop-migration.json'
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
function absolute(value: string): string {
  if (!value || !path.isAbsolute(value)) throw Error('An absolute path is required')
  return path.resolve(value)
}
function noLinks(value: string) {
  for (let current = value; ; current = path.dirname(current)) {
    try { if (lstatSync(current).isSymbolicLink()) throw Error('Path must not traverse a junction/symlink') }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
    if (path.dirname(current) === current) break
  }
}
function json(file: string): Record<string, unknown> {
  noLinks(file)
  const stat = lstatSync(file)
  if (!stat.isFile() || stat.size > 1024 * 1024) throw Error('Expected a JSON file smaller than 1 MiB')
  const value = JSON.parse(readFileSync(file, 'utf8'))
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Expected a JSON object')
  return value
}
function inside(parent: string, child: string): boolean {
  const relative = path.relative(parent, child)
  return !relative || relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
}
function projectRow(projectPath: string) {
  try { return { ...inspectFabricProject(projectPath), name: path.basename(projectPath) } }
  catch { return { path: projectPath, name: path.basename(projectPath), valid: false, errors: ['project path or metadata is inaccessible'] } }
}

/** Reads only path settings. Credentials, conversations, worlds and caches are never read or copied. */
export function inspectDesktopProfile(userData: string, runtimeRoot?: string) {
  const source = absolute(userData); noLinks(source)
  if (!lstatSync(source).isDirectory()) throw Error('Desktop user-data directory is required')
  const settingsFile = path.join(source, 'settings.json')
  const settings = existsSync(settingsFile) ? json(settingsFile) : {}
  const configFile = path.join(source, 'config.json')
  const config = existsSync(configFile) ? json(configFile) : {}
  const warnings: string[] = []
  const candidates: unknown[] = [settings.lastProjectPath]
  if (Array.isArray(settings.recentProjects)) {
    if (settings.recentProjects.length > 1000) throw Error('Too many recent projects')
    for (const item of settings.recentProjects) candidates.push(item && typeof item === 'object' ? item.path : undefined)
  }
  const unique = new Map<string, string>()
  for (const candidate of candidates) {
    if (candidate === undefined) continue
    if (typeof candidate !== 'string' || !candidate.trim() || !path.isAbsolute(candidate.trim())) { warnings.push('Skipped an invalid or relative project path'); continue }
    const value = path.resolve(candidate.trim()), key = process.platform === 'win32' ? value.toLowerCase() : value
    unique.set(key, value)
  }
  const configuredRuntime = runtimeRoot ?? (typeof config.runtimePath === 'string' ? config.runtimePath : undefined)
  const runtime = configuredRuntime ? absolute(configuredRuntime) : undefined
  if (!runtime) warnings.push('Runtime location is unknown; pass --runtime-root for Portable or the installation/runtime directory')
  // Inventory names only. Never follow or deserialize the retained data.
  const entries = new Set(readdirSync(source))
  const retained = ['config.json', 'settings.json', 'chat-sessions', 'api-settings.json', 'api-key.bin', 'api-keys', 'agent-config.json', 'model-routing-config.json', 'harness-workspaces', 'harness-checkpoints', 'harness-baseline-cache', 'game-test-reports', 'skills', 'agent-knowledge-overrides']
    .filter((name) => entries.has(name)).map((name) => path.join(source, name))
  return { migrationVersion: 1 as const, source, runtimeRoot: runtime, runtimePresent: runtime ? existsSync(runtime) : false, projects: [...unique.values()].map(projectRow), retained, warnings }
}

/** Explicit import to a NEW independent data root; no copy/move/delete of source or project contents. */
export function migrateDesktopProfile(userData: string, dataRoot: string, runtimeRoot?: string) {
  const inventory = inspectDesktopProfile(userData, runtimeRoot), destination = absolute(dataRoot)
  noLinks(destination)
  for (const input of [inventory.source, inventory.runtimeRoot, ...inventory.projects.map((row) => row.path)].filter((value): value is string => Boolean(value))) {
    noLinks(input) // refuse aliases that could conceal overlap with a retained project/runtime
    if (inside(input, destination) || inside(destination, input)) throw Error('New data root must be separate from Desktop data, runtime and projects')
  }
  if (existsSync(destination)) throw Error('New data root must not already exist; existing data is never overwritten')
  mkdirSync(path.dirname(destination), { recursive: true })
  mkdirSync(destination) // exclusive ownership; concurrent imports cannot share a target
  const catalog = JSON.stringify({ catalogVersion: 1, projects: inventory.projects.map(({ path }) => ({ path })) }, null, 2) + '\n'
  writeFileSync(path.join(destination, catalogName), catalog, { flag: 'wx' })
  const report = { ...inventory, dataRoot: destination, createdAt: new Date().toISOString(), catalogSha256: hash(catalog), sourceModifiedByImporter: false, resourcePolicy: 'retained-in-place; not imported, linked or automatically consumed' }
  // Commit marker last. An interrupted directory is retained for inspection and must not be retried in place.
  writeFileSync(path.join(destination, markerName), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' })
  return { ...report, readback: readProjectCatalog(destination) }
}

/** Recheck paths on every read; historical validity is never presented as current readiness. */
export function readProjectCatalog(dataRoot: string) {
  const root = absolute(dataRoot), marker = path.join(root, markerName), file = path.join(root, catalogName)
  if (!existsSync(marker) && !existsSync(file)) return { catalogVersion: 1 as const, projects: [], imported: false }
  const receipt = json(marker), value = json(file)
  if (receipt.migrationVersion !== 1 || value.catalogVersion !== 1 || hash(readFileSync(file, 'utf8')) !== receipt.catalogSha256 || !Array.isArray(value.projects) || value.projects.length > 1000) throw Error('Invalid or incomplete Desktop migration')
  const projects = value.projects.map((row: unknown) => {
    if (!row || typeof row !== 'object' || !('path' in row) || typeof row.path !== 'string') throw Error('Invalid project catalog entry')
    return projectRow(absolute(row.path))
  })
  return { catalogVersion: 1 as const, projects, imported: true }
}
