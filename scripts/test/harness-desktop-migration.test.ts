import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync, lstatSync, renameSync, symlinkSync, existsSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createHash } from 'node:crypto'
import { FabricRuntime, createRuntimePaths, inspectDesktopProfile, migrateDesktopProfile, readProjectCatalog } from '../../packages/modcrafting-core/src/index.ts'
import { startBrowserView } from '../../plugins/modcrafting-fabric/src/browser-server.ts'

function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'modcrafting-migration-')), source = path.join(root, 'Desktop profile'), project = path.join(root, 'Fabric 工程'), runtime = path.join(root, 'runtime'), destination = path.join(root, 'Core data')
  for (const folder of [source, path.join(project, 'src/main/resources'), path.join(project, 'node_modules'), path.join(runtime, 'gradle-home'), path.join(source, 'chat-sessions')]) mkdirSync(folder, { recursive: true })
  writeFileSync(path.join(project, 'src/main/resources/fabric.mod.json'), JSON.stringify({ id: 'migration_fixture' }))
  writeFileSync(path.join(project, 'gradlew.bat'), '@echo fixture only'); writeFileSync(path.join(project, 'gradle.properties'), 'minecraft_version=1.21.4')
  writeFileSync(path.join(project, 'node_modules/sentinel'), 'private project dependency')
  writeFileSync(path.join(source, 'settings.json'), JSON.stringify({ lastProjectPath: project, recentProjects: [{ path: project }, { path: path.join(root, 'missing') }, { path: './relative' }], privateField: 'DO_NOT_EXPORT' }))
  writeFileSync(path.join(source, 'config.json'), JSON.stringify({ runtimePath: runtime }))
  // These are intentionally NOT valid JSON. An accidental parser/copy must fail the assertions.
  writeFileSync(path.join(source, 'api-settings.json'), 'SECRET_DO_NOT_READ_OR_COPY')
  writeFileSync(path.join(source, 'chat-sessions/history.json'), 'PRIVATE_CONVERSATION')
  writeFileSync(path.join(runtime, 'gradle-home/cache'), 'RETAIN_IN_PLACE')
  return { root, source, project, runtime, destination }
}
function tree(root: string): Record<string, string> {
  const files: Record<string, string> = {}
  function walk(dir: string) { for (const name of readdirSync(dir)) { const file = path.join(dir, name), stat = lstatSync(file); if (stat.isDirectory()) walk(file); else files[path.relative(root, file)] = createHash('sha256').update(readFileSync(file)).digest('hex') } }
  walk(root); return files
}
test('Desktop inventory is read-only; import preserves sources and imports only distinct absolute project references', () => {
  const f = fixture(), sourceBefore = tree(f.source), runtimeBefore = tree(f.runtime), projectBefore = tree(f.project)
  const inventory = inspectDesktopProfile(f.source)
  assert.equal(existsSync(f.destination), false); assert.equal(inventory.projects.length, 2); assert.equal(inventory.runtimeRoot, f.runtime); assert.equal(inventory.warnings.length, 1)
  const result = migrateDesktopProfile(f.source, f.destination)
  assert.equal(result.readback.projects[0].modId, 'migration_fixture'); assert.equal(result.readback.projects[1].valid, false)
  assert.deepEqual(readdirSync(f.destination).sort(), ['desktop-migration.json', 'projects.json'])
  const output = JSON.stringify(result) + readFileSync(path.join(f.destination, 'projects.json'), 'utf8')
  assert.doesNotMatch(output, /DO_NOT_EXPORT|SECRET_DO_NOT_READ_OR_COPY|PRIVATE_CONVERSATION|RETAIN_IN_PLACE/)
  assert.deepEqual(tree(f.source), sourceBefore); assert.deepEqual(tree(f.runtime), runtimeBefore); assert.deepEqual(tree(f.project), projectBefore)
})
test('Catalog rechecks paths rather than retaining a stale ready status; legacy lastProjectPath fallback is supported', () => {
  const f = fixture(); writeFileSync(path.join(f.source, 'settings.json'), JSON.stringify({ lastProjectPath: f.project }))
  migrateDesktopProfile(f.source, f.destination)
  renameSync(f.project, f.project + '-moved')
  assert.equal(readProjectCatalog(f.destination).projects[0].valid, false)
  assert.deepEqual(readProjectCatalog(path.join(f.root, 'new-empty')).projects, [])
})
test('Import refuses existing data and all overlaps with Desktop, runtime or projects', () => {
  const f = fixture()
  for (const target of [f.source, path.join(f.source, 'child'), f.runtime, path.join(f.runtime, 'data'), f.project, path.join(f.project, 'data'), f.root]) assert.throws(() => migrateDesktopProfile(f.source, target), /separate/)
  mkdirSync(f.destination); writeFileSync(path.join(f.destination, 'keep'), 'user data')
  assert.throws(() => migrateDesktopProfile(f.source, f.destination), /must not already exist/)
  assert.equal(readFileSync(path.join(f.destination, 'keep'), 'utf8'), 'user data')
})
test('Import rejects corrupt/relative inputs before creating any destination and never guesses a Portable runtime', () => {
  const f = fixture()
  assert.throws(() => inspectDesktopProfile('.'), /absolute/)
  assert.throws(() => migrateDesktopProfile(f.source, './relative'), /absolute/)
  writeFileSync(path.join(f.source, 'config.json'), '{}')
  assert.equal(inspectDesktopProfile(f.source).runtimeRoot, undefined)
  assert.equal(inspectDesktopProfile(f.source, f.runtime).runtimeRoot, f.runtime)
  writeFileSync(path.join(f.source, 'settings.json'), '{broken')
  assert.throws(() => migrateDesktopProfile(f.source, f.destination)); assert.equal(existsSync(f.destination), false)
})
test('Import refuses source and destination junctions and their ancestors without touching link targets', () => {
  const f = fixture(), link = path.join(f.root, 'linked'), target = path.join(f.root, 'external'); mkdirSync(target)
  symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir')
  assert.throws(() => migrateDesktopProfile(f.source, path.join(link, 'child')), /junction|symlink/)
  assert.throws(() => inspectDesktopProfile(link), /junction|symlink/)
  // A retained runtime/project alias must not hide a target physically inside old data.
  assert.throws(() => migrateDesktopProfile(f.source, path.join(target, 'child'), link), /junction|symlink/)
  writeFileSync(path.join(f.source, 'settings.json'), JSON.stringify({ lastProjectPath: link }))
  assert.throws(() => migrateDesktopProfile(f.source, path.join(target, 'child')), /junction|symlink/)
  assert.deepEqual(readdirSync(target), [])
})
test('Incomplete and modified catalogs are rejected; a second import never overwrites a completed one', () => {
  const f = fixture(); migrateDesktopProfile(f.source, f.destination)
  assert.throws(() => migrateDesktopProfile(f.source, f.destination), /must not already exist/)
  writeFileSync(path.join(f.destination, 'projects.json'), JSON.stringify({ catalogVersion: 1, projects: [] }))
  assert.throws(() => readProjectCatalog(f.destination), /Invalid or incomplete/)
  const partial = path.join(f.root, 'interrupted'); mkdirSync(partial); writeFileSync(path.join(partial, 'projects.json'), '{}')
  assert.throws(() => readProjectCatalog(partial)); assert.throws(() => migrateDesktopProfile(f.source, partial), /must not already exist/)
})
test('Authenticated browser reads the same imported paths and can inspect them without a Desktop process', async (t) => {
  const f = fixture(); migrateDesktopProfile(f.source, f.destination)
  const runtime = new FabricRuntime({ paths: createRuntimePaths(f.destination), version: 'migration-fixture' })
  const view = await startBrowserView(runtime, { html: '', js: '', css: '' }); t.after(async () => { runtime.close(); await view.close() })
  const url = new URL(view.url), token = new URLSearchParams(url.hash.slice(1)).get('token')!, headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
  assert.equal((await fetch(url.origin + '/api/projects')).status, 401)
  const response = await (await fetch(url.origin + '/api/projects', { headers })).json()
  assert.equal(response.projects[0].path, f.project); assert.equal(response.projects[0].valid, true)
  const opened = await (await fetch(url.origin + '/api/action', { method: 'POST', headers, body: JSON.stringify({ operation: 'project', projectPath: response.projects[0].path }) })).json()
  assert.equal(opened.project.modId, 'migration_fixture')
})
