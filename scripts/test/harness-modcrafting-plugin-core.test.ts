import assert from 'node:assert/strict'
import test from 'node:test'
import * as os from 'node:os'
import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import {
  GAME_TEST_WORLD,
  createRuntimePaths,
  SystemToolchainProvider,
  FABRIC_TARGET,
  searchFabricDocs,
  isAllowedBridgeApiPath,
  scaffoldFabricProject,
  testVerdict,
  validateFabricProject,
  validateGameTestSpec
} from '../../packages/modcrafting-core/src/index.ts'

test('release branch excludes the retired Desktop application and dependency chain', async () => {
  const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'))
  assert.equal(existsSync('src'), false)
  assert.equal(existsSync('electron.vite.config.ts'), false)
  assert.equal(existsSync('scripts/plugin/migrate-desktop.ts'), false)
  assert.equal(packageJson.dependencies?.electron, undefined)
  assert.equal(packageJson.devDependencies?.electron, undefined)
  assert.equal(packageJson.scripts['build:win'], undefined)
})

test('shared core exposes the deterministic Observer and game-test contracts without Electron', () => {
  assert.equal(isAllowedBridgeApiPath('/v2/snapshot'), true)
  assert.equal(isAllowedBridgeApiPath('/v1/input'), true)
  assert.equal(isAllowedBridgeApiPath('/api/delete-everything'), false)
  assert.equal(testVerdict([{ passed: true }]), 'PASS')
  assert.equal(testVerdict([{ passed: false }]), 'FAIL')
  assert.equal(testVerdict([{ passed: true, unavailable: true }]), 'INCONCLUSIVE')
  const parsed = validateGameTestSpec({ version: 2, id: 'test_item', featureType: 'new_item', subject: {}, setup: [], actions: [{ type: 'wait', ms: 0 }], assertions: [{ type: 'inventory_contains', itemId: 'minecraft:stone' }], cleanup: [] })
  assert.equal(parsed.ok, true)
  assert.equal(GAME_TEST_WORLD, 'ModCrafting Test World')
})

test('checked-in first-use example includes loadable metadata and a supported V2 contract', async () => {
  const metadata = JSON.parse(await fs.readFile('examples/iron-ticket/src/main/resources/fabric.mod.json', 'utf8'))
  assert.equal(metadata.id, 'iron_ticket')
  assert.equal(metadata.version, '0.1.0')
  assert.equal(validateGameTestSpec(JSON.parse(await fs.readFile('examples/iron-ticket/test-spec.json', 'utf8'))).ok, true)
})

test('system-toolchain project inspection does not create a wrapper or download toolchain', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'modcrafting-plugin-'))
  try {
    const project = await scaffoldFabricProject(path.join(root, 'example'), 'example_mod', 'Example Mod')
    assert.equal(project.modId, 'example_mod')
    const validation = validateFabricProject(project.path)
    assert.equal(validation.checks.wrapper, false)
    assert.equal(existsSync(path.join(project.path, 'gradlew.bat')), false)
    const paths = createRuntimePaths(path.join(root, 'plugin-data'))
    assert.equal(paths.knowledgeRoot.endsWith('knowledge'), true)
    await fs.mkdir(path.join(paths.assetsRoot, 'agent-knowledge', 'fabric'), { recursive: true })
    await fs.writeFile(path.join(paths.assetsRoot, 'agent-knowledge', 'fabric', 'fixture.md'), 'fixture Fabric documentation')
    assert.equal(searchFabricDocs(paths, 'fixture').assetReady, true)
    assert.equal((searchFabricDocs(paths, 'fixture').hits as unknown[]).length, 1)
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})

test('supplied pinned Wrapper makes a new project buildable without executing Java or overwriting user files', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'modcrafting-scaffold-wrapper-'))
  const projectPath = path.join(directory, 'new project')
  const jar = await fs.readFile('bridge-mod/gradle/wrapper/gradle-wrapper.jar')
  const wrapper = { batch: await fs.readFile('bridge-mod/gradlew.bat', 'utf8'), properties: await fs.readFile('bridge-mod/gradle/wrapper/gradle-wrapper.properties', 'utf8'), jarBase64: jar.toString('base64') }
  const project = await scaffoldFabricProject(projectPath, 'wrapper_fixture', 'Wrapper Fixture', wrapper)
  assert.equal(project.valid, true); assert.equal(validateFabricProject(projectPath).ok, true)
  assert.deepEqual(await fs.readFile(path.join(projectPath, 'gradle/wrapper/gradle-wrapper.jar')), jar)
  assert.match(await fs.readFile(path.join(projectPath, 'gradle/wrapper/gradle-wrapper.properties'), 'utf8'), /distributionSha256Sum=[a-f0-9]{64}/)
  const metadata = JSON.parse(await fs.readFile(path.join(projectPath, 'src/main/resources/fabric.mod.json'), 'utf8'))
  assert.equal(metadata.version, '0.1.0')
  await fs.writeFile(path.join(projectPath, 'user-file'), 'preserve')
  await assert.rejects(scaffoldFabricProject(projectPath, 'wrapper_fixture', 'Again', wrapper), /non-empty/)
  assert.equal(await fs.readFile(path.join(projectPath, 'user-file'), 'utf8'), 'preserve')
})

test('Windows Gradle wrapper launcher runs a fixture batch through cmd without a real JDK/Gradle', { skip: process.platform !== 'win32' ? 'Windows-only batch fixture' : false }, async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'modcrafting-wrapper-'))
  try {
    const project = await scaffoldFabricProject(path.join(root, 'project with spaces'), 'fixture_mod', 'Fixture')
    await fs.writeFile(path.join(project.path, 'gradlew.bat'), '@echo off\r\necho FIXTURE_TASK=%1\r\nexit /b 0\r\n')
    class FixtureProvider extends SystemToolchainProvider {
      async status() { return { ok: true, platform: process.platform, node: process.version, java: { ok: true }, gradleWrapper: true, target: FABRIC_TARGET, remediation: [] } }
    }
    let output = ''
    const child = await new FixtureProvider().startGradle(project.path, 'build', { onLog: (_, text) => { output += text } })
    const code = await new Promise<number>((resolve, reject) => { const timer = setTimeout(() => { child.kill(); reject(new Error('Fixture batch timed out')) }, 3000); child.once('error', (error) => { clearTimeout(timer); reject(error) }); child.once('close', (code) => { clearTimeout(timer); resolve(code ?? -1) }) })
    assert.equal(code, 0)
    assert.match(output, /FIXTURE_TASK=build/)
    await assert.rejects(new FixtureProvider().startGradle(project.path, 'build&echo'), /Unsafe/)
  } finally { await fs.rm(root, { recursive: true, force: true }) }
})
