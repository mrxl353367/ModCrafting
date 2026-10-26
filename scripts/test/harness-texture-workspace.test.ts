import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import sharp from 'sharp'
import { textureWorkspace, type TextureRequest } from '../../packages/modcrafting-core/src/index.ts'

function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'modcrafting-texture-')), project = path.join(root, 'project')
  mkdirSync(path.join(project, 'src/main/resources'), { recursive: true })
  writeFileSync(path.join(project, 'src/main/resources/fabric.mod.json'), JSON.stringify({ schemaVersion: 1, id: 'tex_test', version: '1', depends: { minecraft: '1.21.4' } }))
  writeFileSync(path.join(project, 'gradlew.bat'), '@echo fixture'); writeFileSync(path.join(project, 'gradle.properties'), 'minecraft_version=1.21.4\n')
  const call = (value: Record<string, unknown>) => textureWorkspace({ projectPath: project, ...value } as TextureRequest)
  return { root, project, call }
}

test('GUI texture workspace saves an atomic PNG, lists it and rejects stale writes', async () => {
  const f = fixture(), png = await sharp({ create: { width: 64, height: 16, channels: 4, background: { r: 220, g: 40, b: 40, alpha: 1 } } }).png().toBuffer(), texturePng = 'data:image/png;base64,' + png.toString('base64')
  const saved = f.call({ action: 'save', id: 'tex_test:gui/health_bar', texturePng, expectedRevision: null }) as Record<string, any>
  assert.equal(saved.ok, true)
  assert.equal(saved.document.path, 'src/main/resources/assets/tex_test/textures/gui/health_bar.png')
  assert.equal(saved.document.width, 64); assert.equal(saved.document.height, 16)
  assert.deepEqual(readFileSync(path.join(f.project, saved.document.path)), png)
  const listed = f.call({ action: 'list' }) as Record<string, any>
  assert.deepEqual(listed.textures.map((item: any) => item.id), ['tex_test:gui/health_bar'])
  const read = f.call({ action: 'read', id: 'tex_test:gui/health_bar' }) as Record<string, any>
  assert.ok(read.document.image.startsWith('data:image/png;base64,'))
  assert.throws(() => f.call({ action: 'save', id: 'tex_test:gui/health_bar', texturePng, expectedRevision: null }), /冲突|修改/)
  writeFileSync(path.join(f.project, saved.document.path), Buffer.concat([png, Buffer.from([0])]))
  assert.throws(() => f.call({ action: 'read', id: 'tex_test:gui/health_bar' }), /不一致|检查/)
})

test('GUI texture workspace refuses traversal, invalid PNG and unmanaged overwrite', async () => {
  const f = fixture()
  assert.throws(() => f.call({ action: 'read', id: 'tex_test:gui/../escape' }))
  assert.throws(() => f.call({ action: 'save', id: 'tex_test:gui/bad', texturePng: 'data:image/png;base64,bm90LXBuZw==', expectedRevision: null }))
  const target = path.join(f.project, 'src/main/resources/assets/tex_test/textures/gui/manual.png')
  mkdirSync(path.dirname(target), { recursive: true }); const png = await sharp({ create: { width: 16, height: 16, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } }).png().toBuffer(); writeFileSync(target, png)
  assert.throws(() => f.call({ action: 'save', id: 'tex_test:gui/manual', texturePng: 'data:image/png;base64,' + png.toString('base64'), expectedRevision: null }), /不受纹理编辑器管理/)
  assert.equal(existsSync(path.join(f.project, '.modcrafting/textures/gui/manual.json')), false)
})
