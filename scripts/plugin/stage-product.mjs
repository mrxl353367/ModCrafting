import { parseArgs } from 'node:util'
import { cp, copyFile, lstat, mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import unzipper from 'unzipper'
import { validatePlugin } from './validate.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const { values } = parseArgs({ options: { 'bench-dir': { type: 'string' }, 'observer-jar': { type: 'string' }, 'observer-sources': { type: 'string' }, help: { type: 'boolean' } } })
if (values.help) { console.log('Usage: product:stage --bench-dir built-Bench-directory --observer-jar built-Observer-V2.jar [--observer-sources sources.jar]'); process.exit(0) }
if (!values['bench-dir'] || !values['observer-jar']) throw Error('--bench-dir and --observer-jar are required; this command never builds/downloads Java dependencies')
const plugin = path.join(root, 'temp/plugin-artifacts/modcrafting-fabric'), bench = path.resolve(values['bench-dir']), observer = path.resolve(values['observer-jar'])
validatePlugin(plugin, true)
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const benchManifest = JSON.parse(await readFile(path.join(bench, 'manifest.json'), 'utf8'))
const benchFiles = ['run-fabric-bench.mjs', 'run-fabric-bench-live.mjs', 'fabric-bench-mvp.json', 'fabric-bench-live-mvp.json', 'README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.txt', 'manifest.json']
async function ordinary(file) { const stat = await lstat(file); if (!stat.isFile() || stat.isSymbolicLink()) throw Error(`Not an ordinary input file: ${path.basename(file)}`) }
for (const name of benchFiles) {
  const file = path.join(bench, name); await ordinary(file)
  if (name !== 'manifest.json' && sha256(await readFile(file)) !== benchManifest.files[name]) throw Error(`Bench manifest mismatch: ${name}`)
}
await ordinary(observer)
const archive = await unzipper.Open.file(observer)
const mod = JSON.parse(await archive.files.find((file) => file.path === 'fabric.mod.json').buffer())
if (mod.id !== 'modcrafting_observer' || mod.custom?.modcrafting?.observerProtocol !== 2 || mod.depends?.minecraft !== '~1.21.4') throw Error('Observer must declare protocol 2 and Minecraft 1.21.4; released V1 assets cannot satisfy this product')
const outputRoot = path.join(root, 'temp/product-artifacts')
for (const directory of [path.join(root, 'temp'), outputRoot]) {
  try { if ((await lstat(directory)).isSymbolicLink()) throw Error('Product output must not traverse a junction/symlink') }
  catch (error) { if (error.code !== 'ENOENT') throw error }
}
await mkdir(outputRoot, { recursive: true })
const directory = await mkdtemp(path.join(outputRoot, 'modcrafting-'))
await cp(plugin, path.join(directory, 'plugin'), { recursive: true })
await mkdir(path.join(directory, 'bench')); for (const name of benchFiles) await copyFile(path.join(bench, name), path.join(directory, 'bench', name))
await mkdir(path.join(directory, 'observer')); await copyFile(observer, path.join(directory, 'observer/modcrafting-observer.jar'))
await copyFile(path.join(root, 'bridge-mod/LICENSE'), path.join(directory, 'observer/LICENSE'))
if (values['observer-sources']) { await ordinary(path.resolve(values['observer-sources'])); await copyFile(path.resolve(values['observer-sources']), path.join(directory, 'observer/sources.jar')) }
await writeFile(path.join(directory, 'README.md'), (await readFile(path.join(root, 'docs/product-handoff.md'), 'utf8')).replaceAll('./desktop-retirement.md', './MIGRATION.md').replaceAll('./candidate-validation.md', './CANDIDATE.md'), { flag: 'wx' })
await copyFile(path.join(root, 'docs/candidate-validation.md'), path.join(directory, 'CANDIDATE.md'))
const exampleFiles = ['README.md', 'test-spec.json', 'src/main/java/com/modcrafting/example/IronTicketMod.java', 'src/main/resources/fabric.mod.json', 'src/main/resources/assets/iron_ticket/lang/zh_cn.json', 'src/main/resources/assets/iron_ticket/lang/en_us.json', 'src/main/resources/assets/iron_ticket/models/item/ticket.json', 'src/main/resources/assets/iron_ticket/items/ticket.json']
for (const file of exampleFiles) {
  const source = path.join(root, 'examples/iron-ticket', file), target = path.join(directory, 'examples/iron-ticket', file)
  await ordinary(source); await mkdir(path.dirname(target), { recursive: true })
  if (file === 'README.md') await writeFile(target, (await readFile(source, 'utf8')).replaceAll('../../docs/candidate-validation.md', '../../CANDIDATE.md'), { flag: 'wx' })
  else await copyFile(source, target)
}
await ordinary(path.join(root, 'temp/migration-artifacts/migrate-desktop.mjs'))
await copyFile(path.join(root, 'temp/migration-artifacts/migrate-desktop.mjs'), path.join(directory, 'migrate-desktop.mjs'))
await copyFile(path.join(root, 'docs/desktop-retirement.md'), path.join(directory, 'MIGRATION.md'))
const files = {}
async function fingerprint(current) {
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const file = path.join(current, entry.name)
    if (entry.isDirectory()) await fingerprint(file)
    else if (entry.isFile()) files[path.relative(directory, file).replace(/\\/g, '/')] = sha256(await readFile(file))
    else throw Error('Product contains a link or special file')
  }
}
await fingerprint(directory)
await writeFile(path.join(directory, 'manifest.json'), JSON.stringify({ productManifestVersion: 1, target: { platform: 'win32-x64', minecraft: '1.21.4', observerProtocol: 2 }, observer: { version: mod.version, declaredProtocol: 2, runtimeValidationRequired: true }, files }, null, 2), { flag: 'wx' })
console.log(JSON.stringify({ ok: true, directory, fileCount: Object.keys(files).length + 1, observerVersion: mod.version, manifest: 'manifest.json' }))
