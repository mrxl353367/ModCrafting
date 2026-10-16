import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, symlinkSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { itemImage, textureImage, prepareVisualAssets } from '../../packages/modcrafting-core/src/visual-assets.ts'
import { createRuntimePaths } from '../../packages/modcrafting-core/src/node.ts'

const png = Buffer.from('89504e470d0a1a0a00000000', 'hex')
function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'modcrafting-visuals-')), paths = createRuntimePaths(path.join(root, 'data')), project = path.join(root, 'project')
  const cache = path.join(paths.assetsRoot, 'minecraft-textures/1.21.4')
  const put = (base: string, name: string, value: unknown) => { const file = path.join(base, name); mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, Buffer.isBuffer(value) ? value : JSON.stringify(value)); return file }
  return { root, paths, project, cache, put }
}
test('Vanilla block icons follow 1.21.4 item definitions, inherited models and texture variables', () => {
  const f = fixture(), a = 'assets/minecraft/'
  f.put(f.cache, a + 'items/stone.json', { model: { type: 'minecraft:model', model: 'minecraft:block/stone' } })
  f.put(f.cache, a + 'models/block/stone.json', { parent: 'minecraft:block/cube_all', textures: { all: 'minecraft:block/stone' } })
  f.put(f.cache, a + 'models/block/cube_all.json', { textures: { particle: '#all' } })
  f.put(f.cache, a + 'textures/block/stone.png', png)
  assert.equal(itemImage(f.paths, f.project, 'minecraft:stone'), 'data:image/png;base64,' + png.toString('base64'))
  assert.equal(itemImage(f.paths, f.project, 'minecraft:unknown'), undefined)
})
test('Project models and textures override vanilla without copying into or rewriting the project', () => {
  const f = fixture(), assets = path.join(f.project, 'src/main/resources'), a = 'assets/example/'
  f.put(assets, a + 'items/tool.json', { model: { type: 'minecraft:model', model: 'example:item/tool' } })
  f.put(assets, a + 'models/item/tool.json', { parent: 'minecraft:item/generated', textures: { layer0: '#custom', custom: 'example:item/blue' } })
  const file = f.put(assets, a + 'textures/item/blue.png', png)
  assert.ok(itemImage(f.paths, f.project, 'example:tool'))
  assert.ok(textureImage(f.paths, f.project, 'example:item/blue'))
  assert.deepEqual(readFileSync(file), png)
  assert.equal(itemImage(f.paths, f.project, '../escape:item/blue'), undefined)
  assert.equal(textureImage(f.paths, f.project, 'example:item/../../secret'), undefined)
  f.put(assets, a + 'models/item/cycle.json', { parent: 'example:item/cycle', textures: { layer0: '#loop', loop: '#loop' } })
  assert.equal(itemImage(f.paths, f.project, 'example:cycle'), undefined)
  const outside = f.put(f.root, 'outside.png', png)
  symlinkSync(path.dirname(outside), path.join(assets, 'assets/linked'), 'junction')
  assert.throws(() => textureImage(f.paths, f.project, 'linked:outside'), /链接/)
})
test('A cold local client cache is version checked and extracts only bounded PNG/JSON resources', { skip: process.platform !== 'win32' }, async () => {
  const f = fixture(), gradle = path.join(f.root, 'gradle'), jar = path.join(gradle, 'caches/fabric-loom/1.21.4/minecraft-client.jar')
  mkdirSync(path.dirname(jar), { recursive: true })
  const script = `Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip=[IO.Compression.ZipFile]::Open($env:VISUAL_TEST_JAR,'Create')
try { foreach($key in @('version.json','assets/minecraft/textures/item/apple.png','assets/minecraft/items/apple.json','../escape.png','secret.txt')) {
 $entry=$zip.CreateEntry($key); $stream=$entry.Open(); try {
 $data=if($key -eq 'version.json'){[Text.Encoding]::UTF8.GetBytes('{"id":"1.21.4"}')}elseif($key.EndsWith('.png')){[Convert]::FromBase64String('${png.toString('base64')}')}else{[Text.Encoding]::UTF8.GetBytes('{}')};$stream.Write($data,0,$data.Length)
 }finally{$stream.Dispose()}
} }finally{$zip.Dispose()}`
  const created = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { windowsHide: true, env: { ...process.env, VISUAL_TEST_JAR: jar }, encoding: 'utf8' })
  assert.equal(created.status, 0, created.stderr)
  const old = process.env.GRADLE_USER_HOME; process.env.GRADLE_USER_HOME = gradle
  try {
    const [one, two] = await Promise.all([prepareVisualAssets(f.paths), prepareVisualAssets(f.paths)])
    assert.equal(one.ready, true, one.message); assert.deepEqual(one, two)
    assert.ok(textureImage(f.paths, f.project, 'minecraft:item/apple'))
    assert.equal(existsSync(path.join(f.cache, 'secret.txt')), false)
    assert.equal(existsSync(path.join(f.cache, '../escape.png')), false)
    assert.equal((await prepareVisualAssets(f.paths)).ready, true)
  } finally { if (old === undefined) delete process.env.GRADLE_USER_HOME; else process.env.GRADLE_USER_HOME = old }
})
