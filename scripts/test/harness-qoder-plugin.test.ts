import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'
import { createHash } from 'node:crypto'
import unzipper from 'unzipper'
import { mkdir, mkdtemp, readFile, writeFile, symlink } from 'node:fs/promises'
import { stageQoder } from '../plugin/stage-qoder.mjs'

const output = path.resolve('temp/qoder-plugin-tests')
await mkdir(output, { recursive: true })
const root = await mkdtemp(path.join(output, 'run-'))
const source = path.join(root, 'source')
for (const dir of ['.codex-plugin', 'dist', 'assets', 'skills/modcrafting-start', 'skills/fabric-mod-development', 'skills/fabric-game-validation', '.data']) await mkdir(path.join(source, dir), { recursive: true })
await writeFile(path.join(source, '.codex-plugin/plugin.json'), JSON.stringify({ name: 'modcrafting-fabric', version: '0.1.0+desktop.fixture', license: 'GPL-3.0' }))
const bundle = '// fixture --web modcrafting_open_workbench\n'
const compatibility = { contractVersion: 1, version: '0.1.0+desktop.fixture', minecraft: '1.21.4', observer: { protocol: 2, sha256: 'a'.repeat(64) }, coreBundleSha256: createHash('sha256').update(bundle).digest('hex') }
await writeFile(path.join(source, 'dist/mcp-server.js'), bundle)
await writeFile(path.join(source, 'compatibility.json'), JSON.stringify(compatibility))
for (const file of ['LICENSE', 'THIRD_PARTY_NOTICES.txt', 'assets/modcrafting.png', '.data/private.txt']) await writeFile(path.join(source, file), 'fixture')
for (const name of ['modcrafting-start', 'fabric-mod-development', 'fabric-game-validation']) await writeFile(path.join(source, `skills/${name}/SKILL.md`), `---\nname: ${name}\ndescription: fixture\n---\n`)

test('native desktop package preserves the bundle and excludes user state and foreign manifests', async () => {
  const result = await stageQoder({ source, outputRoot: path.join(root, 'artifacts') })
  const manifest = JSON.parse(await readFile(path.join(result.plugin, '.qoder-plugin/plugin.json'), 'utf8'))
  assert.equal(manifest.version, '0.1.0+qoder.fixture')
  assert.equal(manifest.skills, './skills/')
  assert.equal(manifest.commands, './commands/')
  assert.equal(manifest.mcpServers, './.mcp.json')
  assert.equal(await readFile(path.join(result.plugin, 'dist/mcp-server.js'), 'utf8'), bundle)
  const config = JSON.parse(await readFile(path.join(result.plugin, '.mcp.json'), 'utf8'))
  assert.deepEqual(config.mcpServers['modcrafting-fabric'].args, ['${QODER_PLUGIN_ROOT}/dist/mcp-server.js', '--web'])
  assert.equal(config.mcpServers['modcrafting-fabric'].env.MODCRAFTING_DATA, '${QODER_PLUGIN_DATA}')
  const fingerprints = JSON.parse(await readFile(path.join(result.directory, 'manifest.json'), 'utf8'))
  assert.equal(fingerprints.machineSpecific, false)
  assert.equal(Object.keys(fingerprints.files).some(file => file.startsWith('.data/') || file.startsWith('.codex-plugin/')), false)
  assert.equal((await readFile(result.zip)).subarray(0, 2).toString(), 'PK')
  const archive = await unzipper.Open.file(result.zip)
  assert.ok(archive.files.every(file => !file.path.includes('\\')), 'ZIP entry paths must be portable forward slashes')
  assert.deepEqual(archive.files.filter(file => file.type === 'File').map(file => file.path).sort(), Object.keys(fingerprints.files).sort())
})

test('packager rejects relative inputs and output nested in source', async () => {
  await assert.rejects(stageQoder({ source: '.' }), /absolute/)
  await assert.rejects(stageQoder({ source, dataRoot: 'relative' }), /absolute/)
  await assert.rejects(stageQoder({ source, gradleHome: 'relative' }), /absolute/)
  await assert.rejects(stageQoder({ source, outputRoot: path.join(source, 'output') }), /outside/)
})

test('local package pins only the requested cache and data paths without changing the core bundle', async () => {
  const gradleHome = path.join(root, 'Gradle 中文 cache'), dataRoot = path.join(root, 'data')
  const result = await stageQoder({ source, outputRoot: path.join(root, 'local-artifacts'), dataRoot, gradleHome, node: process.execPath })
  const config = JSON.parse(await readFile(path.join(result.plugin, '.mcp.json'), 'utf8')).mcpServers['modcrafting-fabric']
  assert.equal(config.env.MODCRAFTING_DATA, dataRoot); assert.equal(config.env.GRADLE_USER_HOME, gradleHome)
  assert.equal(config.command, process.execPath); assert.equal(result.machineSpecific, true)
  assert.equal(await readFile(path.join(result.plugin, 'dist/mcp-server.js'), 'utf8'), bundle)
})

test('packager rejects a junction that redirects output into source', async () => {
  const junction = path.join(root, 'redirect')
  await symlink(source, junction, 'junction')
  await assert.rejects(stageQoder({ source, outputRoot: path.join(junction, 'output') }), /inside/)
})

test('packager rejects stale compatibility receipts and packages without a matching Observer', async () => {
  await writeFile(path.join(source, 'compatibility.json'), JSON.stringify({ ...compatibility, coreBundleSha256: 'b'.repeat(64) }))
  await assert.rejects(stageQoder({ source, outputRoot: path.join(root, 'bad-hash') }), /matching Observer/)
  await writeFile(path.join(source, 'compatibility.json'), JSON.stringify({ ...compatibility, observer: null }))
  await assert.rejects(stageQoder({ source, outputRoot: path.join(root, 'no-observer') }), /matching Observer/)
  await writeFile(path.join(source, 'compatibility.json'), JSON.stringify(compatibility))
})
