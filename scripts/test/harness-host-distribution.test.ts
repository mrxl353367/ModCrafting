import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, mkdir, readFile, writeFile, readdir, symlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createHash } from 'node:crypto'
import { renderHostConfig, writeHostConfig } from '../plugin/host-config.mjs'
import { stageHosts } from '../plugin/stage-hosts.mjs'

test('Host config uses absolute argv, explicit separate data and optional browser without copying ambient secrets', () => {
  const directory = path.join(os.tmpdir(), 'ModCrafting 安装 with spaces'), data = path.join(os.tmpdir(), 'ModCrafting 数据')
  for (const host of ['claude', 'qoder']) {
    const value = JSON.parse(renderHostConfig({ host, pluginDirectory: directory, dataRoot: data, node: process.execPath, web: true }))
    assert.deepEqual(value.mcpServers['modcrafting-fabric'], { type: 'stdio', command: process.execPath, args: [path.join(directory, 'dist/mcp-server.js'), '--web'], cwd: directory, env: { MODCRAFTING_DATA: data } })
  }
  const toml = renderHostConfig({ host: 'codex', pluginDirectory: directory, dataRoot: data })
  assert.ok(toml.startsWith('[mcp_servers.modcrafting-fabric]\n'))
  assert.deepEqual(JSON.parse(toml.split('\n').find((row) => row.startsWith('args = '))!.slice(7)), [path.join(directory, 'dist/mcp-server.js')])
  assert.ok(toml.includes(`MODCRAFTING_DATA = ${JSON.stringify(data)}`))
})
test('Host config refuses relative paths, unknown hosts and data nested in install directory', () => {
  const pluginDirectory = path.join(os.tmpdir(), 'install'), dataRoot = path.join(os.tmpdir(), 'data')
  for (const options of [{ host: 'unknown', pluginDirectory, dataRoot }, { host: 'codex', pluginDirectory: '.', dataRoot }, { host: 'codex', pluginDirectory, dataRoot: '.' }, { host: 'claude', pluginDirectory, dataRoot: pluginDirectory }, { host: 'qoder', pluginDirectory, dataRoot: path.join(pluginDirectory, 'data') }, { host: 'claude', pluginDirectory, dataRoot, node: 'node --eval unsafe' }]) assert.throws(() => renderHostConfig(options))
})
test('Host config only creates new files; preserves existing content and refuses link output', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'modcrafting-host-config-')), pluginDirectory = path.join(root, 'plugin')
  const options = { host: 'claude', pluginDirectory, dataRoot: path.join(root, 'data') }, output = path.join(root, 'generated/mcp.json')
  assert.throws(() => writeHostConfig(options, output)); assert.equal(existsSync(output), false)
  await mkdir(path.join(pluginDirectory, 'dist'), { recursive: true }); await writeFile(path.join(pluginDirectory, 'dist/mcp-server.js'), '// fixture')
  writeHostConfig(options, output); const before = await readFile(output, 'utf8')
  assert.throws(() => writeHostConfig(options, output), /EEXIST/); assert.equal(await readFile(output, 'utf8'), before)
  const target = path.join(root, 'target'), linked = path.join(root, 'linked'); await mkdir(target); await symlink(target, linked, process.platform === 'win32' ? 'junction' : 'dir')
  assert.throws(() => writeHostConfig(options, path.join(linked, 'mcp.json')), /junction|symlink/)
  assert.equal(existsSync(path.join(target, 'mcp.json')), false)
})
async function productFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'modcrafting-host-stage-')), product = path.join(root, 'input'), plugin = path.join(product, 'plugin')
  const identity = JSON.parse(await readFile('plugins/modcrafting-fabric/.codex-plugin/plugin.json', 'utf8'))
  const files = {
    '.codex-plugin/plugin.json': JSON.stringify(identity),
    '.mcp.json': await readFile('plugins/modcrafting-fabric/.mcp.json', 'utf8'),
    'dist/mcp-server.js': `// fixture only ${JSON.stringify(identity.version)}`,
    'assets/modcrafting.png': 'fixture icon', 'README.md': 'fixture readme', 'LICENSE': 'fixture license', 'THIRD_PARTY_NOTICES.txt': 'fixture notices', 'compatibility.json': '{}',
    'skills/fabric-mod-development/SKILL.md': '---\nname: fabric-mod-development\n---\nfixture skill',
    'skills/fabric-game-validation/SKILL.md': '---\nname: fabric-game-validation\n---\nfixture skill'
  }
  const hashes = {}
  for (const [file, text] of Object.entries(files)) { const target = path.join(plugin, file); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, text); hashes[`plugin/${file}`] = createHash('sha256').update(text).digest('hex') }
  await writeFile(path.join(product, 'manifest.json'), JSON.stringify({ productManifestVersion: 1, files: hashes }))
  return { root, product, files }
}
test('Host staging preserves one bundle/skills/licenses, uses distinct manifests and never overwrites input/output', async () => {
  const f = await productFixture(), output = path.join(f.root, 'output')
  const first = await stageHosts(f.product, output), second = await stageHosts(f.product, output)
  assert.notEqual(first.directory, second.directory)
  const manifest = JSON.parse(await readFile(path.join(first.directory, 'manifest.json'), 'utf8'))
  for (const [host, relative] of Object.entries(first.plugins)) {
    const plugin = path.join(first.directory, relative as string)
    const bundle = await readFile(path.join(plugin, 'dist/mcp-server.js'), 'utf8')
    assert.equal(bundle, f.files['dist/mcp-server.js'])
    assert.equal(await readFile(path.join(plugin, 'skills/fabric-mod-development/SKILL.md'), 'utf8'), f.files['skills/fabric-mod-development/SKILL.md'])
    assert.equal(await readFile(path.join(plugin, 'LICENSE'), 'utf8'), f.files.LICENSE)
    const native = JSON.parse(await readFile(path.join(plugin, `.${host}-plugin/plugin.json`), 'utf8'))
    assert.equal(native.name, 'modcrafting-fabric')
    if (host !== 'codex') {
      assert.equal(existsSync(path.join(plugin, '.codex-plugin')), false)
      const config = JSON.parse(await readFile(path.join(plugin, '.mcp.json'), 'utf8')).mcpServers['modcrafting-fabric']
      assert.deepEqual(config.args, [`\${${host.toUpperCase()}_PLUGIN_ROOT}/dist/mcp-server.js`])
    }
    assert.equal(manifest.files[`${relative}/dist/mcp-server.js`], first.coreBundleSha256)
  }
  assert.equal((await readdir(f.product)).length, 2)
  await assert.rejects(stageHosts(f.product, path.join(f.product, 'output')), /outside/)
})
test('Host staging rejects fingerprint changes, unexpected files and input links before copying a package', async () => {
  const f = await productFixture()
  await writeFile(path.join(f.product, 'plugin/dist/mcp-server.js'), 'changed')
  await assert.rejects(stageHosts(f.product, path.join(f.root, 'out')), /fingerprint/)
  assert.equal(existsSync(path.join(f.root, 'out')), false)
  await writeFile(path.join(f.product, 'plugin/dist/mcp-server.js'), f.files['dist/mcp-server.js'])
  await writeFile(path.join(f.product, 'private.txt'), 'must not be shipped')
  await assert.rejects(stageHosts(f.product), /file list/)
  const g = await productFixture(); await symlink(path.join(g.product, 'plugin'), path.join(g.product, 'linked'), process.platform === 'win32' ? 'junction' : 'dir')
  await assert.rejects(stageHosts(g.product), /junction|symlink/)
  const linkedRoot = path.join(f.root, 'linked-input'); await symlink(f.product, linkedRoot, process.platform === 'win32' ? 'junction' : 'dir')
  await assert.rejects(stageHosts(linkedRoot), /junction|symlink/)
})
