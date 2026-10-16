import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'
import { mkdir, mkdtemp, readFile, writeFile, symlink } from 'node:fs/promises'
import { stageQoder } from '../plugin/stage-qoder.mjs'

const output = path.resolve('temp/qoder-plugin-tests')
await mkdir(output, { recursive: true })
const root = await mkdtemp(path.join(output, 'run-'))
const source = path.join(root, 'source')
for (const dir of ['.codex-plugin', 'dist', 'assets', 'skills/fabric-mod-development', 'skills/fabric-game-validation', '.data']) await mkdir(path.join(source, dir), { recursive: true })
await writeFile(path.join(source, '.codex-plugin/plugin.json'), JSON.stringify({ name: 'modcrafting-fabric', version: '0.1.0+desktop.fixture', license: 'GPL-3.0' }))
await writeFile(path.join(source, 'dist/mcp-server.js'), '// fixture --web\n')
for (const file of ['LICENSE', 'THIRD_PARTY_NOTICES.txt', 'assets/modcrafting.png', '.data/private.txt']) await writeFile(path.join(source, file), 'fixture')
for (const name of ['fabric-mod-development', 'fabric-game-validation']) await writeFile(path.join(source, `skills/${name}/SKILL.md`), `---\nname: ${name}\ndescription: fixture\n---\n`)

test('native desktop package preserves the bundle and excludes user state and foreign manifests', async () => {
  const result = await stageQoder({ source, outputRoot: path.join(root, 'artifacts') })
  const manifest = JSON.parse(await readFile(path.join(result.plugin, '.qoder-plugin/plugin.json'), 'utf8'))
  assert.equal(manifest.version, '0.1.0+qoder.fixture')
  assert.equal(manifest.skills, './skills/')
  assert.equal(manifest.commands, './commands/')
  assert.equal(manifest.mcpServers, './.mcp.json')
  assert.equal(await readFile(path.join(result.plugin, 'dist/mcp-server.js'), 'utf8'), '// fixture --web\n')
  const config = JSON.parse(await readFile(path.join(result.plugin, '.mcp.json'), 'utf8'))
  assert.deepEqual(config.mcpServers['modcrafting-fabric'].args, ['${QODER_PLUGIN_ROOT}/dist/mcp-server.js', '--web'])
  assert.equal(config.mcpServers['modcrafting-fabric'].env.MODCRAFTING_DATA, '${QODER_PLUGIN_DATA}')
  const fingerprints = JSON.parse(await readFile(path.join(result.directory, 'manifest.json'), 'utf8'))
  assert.equal(fingerprints.machineSpecific, false)
  assert.equal(Object.keys(fingerprints.files).some(file => file.startsWith('.data/') || file.startsWith('.codex-plugin/')), false)
  assert.equal((await readFile(result.zip)).subarray(0, 2).toString(), 'PK')
})

test('packager rejects relative inputs and output nested in source', async () => {
  await assert.rejects(stageQoder({ source: '.' }), /absolute/)
  await assert.rejects(stageQoder({ source, dataRoot: 'relative' }), /absolute/)
  await assert.rejects(stageQoder({ source, outputRoot: path.join(source, 'output') }), /outside/)
})

test('packager rejects a junction that redirects output into source', async () => {
  const junction = path.join(root, 'redirect')
  await symlink(source, junction, 'junction')
  await assert.rejects(stageQoder({ source, outputRoot: path.join(junction, 'output') }), /inside/)
})
