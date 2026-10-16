import { cp, copyFile, mkdir, mkdtemp, readFile, readdir, writeFile, lstat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { createHash } from 'node:crypto'
import { validatePlugin } from './validate.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const HOSTS = ['codex', 'claude', 'qoder']
export function hostManifest(source) {
  const { name, version, author, homepage, repository, license, keywords } = source
  return { name, version, description: 'Develop and deterministically validate Fabric 1.21.4 mods with an external Agent.', author, homepage, repository, license, keywords }
}
export function hostMcpConfig(host) {
  if (!['claude', 'qoder'].includes(host)) throw Error('Use the original Codex configuration for codex')
  const prefix = host.toUpperCase()
  return { mcpServers: { 'modcrafting-fabric': { command: 'node', args: [`\${${prefix}_PLUGIN_ROOT}/dist/mcp-server.js`], env: { MODCRAFTING_DATA: `\${${prefix}_PLUGIN_DATA}` } } } }
}
async function ordinaryFiles(directory) {
  const files = []
  async function walk(current, prefix = '') {
    for (const name of await readdir(current)) {
      const file = path.join(current, name), relative = `${prefix}${name}`, stat = await lstat(file)
      if (stat.isSymbolicLink()) throw Error(`Input contains a junction/symlink: ${relative}`)
      if (stat.isDirectory()) await walk(file, `${relative}/`)
      else if (stat.isFile()) files.push(relative)
      else throw Error(`Input is not an ordinary file: ${relative}`)
    }
  }
  await walk(directory); return files.sort()
}
const sha = (value) => createHash('sha256').update(value).digest('hex')
export async function stageHosts(productDirectory, outputRoot = path.join(root, 'temp/host-artifacts')) {
  const product = path.resolve(productDirectory)
  if ((await lstat(product)).isSymbolicLink()) throw Error('Input product must not be a junction/symlink')
  const manifest = JSON.parse(await readFile(path.join(product, 'manifest.json'), 'utf8'))
  const actual = await ordinaryFiles(product)
  if (JSON.stringify(actual) !== JSON.stringify([...Object.keys(manifest.files), 'manifest.json'].sort())) throw Error('Product file list differs from its manifest')
  for (const [file, expected] of Object.entries(manifest.files)) {
    if (sha(await readFile(path.join(product, file))) !== expected) throw Error(`Product fingerprint mismatch: ${file}`)
  }
  const source = path.join(product, 'plugin'), { manifest: identity } = validatePlugin(source, true)
  for (let current = path.resolve(outputRoot); ; current = path.dirname(current)) {
    try { if ((await lstat(current)).isSymbolicLink()) throw Error('Host output must not traverse a junction/symlink') }
    catch (error) { if (error.code !== 'ENOENT') throw error }
    if (path.dirname(current) === current) break
  }
  const relative = path.relative(product, path.resolve(outputRoot))
  if (!relative || relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) throw Error('Host output must be outside the input product')
  await mkdir(outputRoot, { recursive: true })
  const destination = await mkdtemp(path.join(outputRoot, 'modcrafting-'))
  // The verified product's plugin is the Codex package; all adapters reuse its JS/skills/licenses.
  await cp(product, path.join(destination, 'product'), { recursive: true, force: false, errorOnExist: true })
  const common = (await ordinaryFiles(source)).filter((file) => file !== '.codex-plugin/plugin.json' && file !== '.mcp.json')
  for (const host of ['claude', 'qoder']) {
    const plugin = path.join(destination, host, 'modcrafting-fabric')
    for (const file of common) { await mkdir(path.dirname(path.join(plugin, file)), { recursive: true }); await copyFile(path.join(source, file), path.join(plugin, file)) }
    await mkdir(path.join(plugin, `.${host}-plugin`))
    await writeFile(path.join(plugin, `.${host}-plugin/plugin.json`), JSON.stringify(hostManifest(identity), null, 2) + '\n')
    await writeFile(path.join(plugin, '.mcp.json'), JSON.stringify(hostMcpConfig(host), null, 2) + '\n')
  }
  await copyFile(path.join(root, 'scripts/plugin/host-config.mjs'), path.join(destination, 'host-config.mjs'))
  await copyFile(path.join(root, 'docs/host-distribution.md'), path.join(destination, 'README.md'))
  const files = {}
  for (const file of await ordinaryFiles(destination)) files[file] = sha(await readFile(path.join(destination, file)))
  const plugins = { codex: 'product/plugin', claude: 'claude/modcrafting-fabric', qoder: 'qoder/modcrafting-fabric' }
  await writeFile(path.join(destination, 'manifest.json'), JSON.stringify({ hostManifestVersion: 1, version: identity.version, plugins, coreBundleSha256: files['product/plugin/dist/mcp-server.js'], files }, null, 2) + '\n', { flag: 'wx' })
  return { directory: destination, plugins, fileCount: Object.keys(files).length + 1, coreBundleSha256: files['product/plugin/dist/mcp-server.js'] }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { 'product-dir': { type: 'string' }, help: { type: 'boolean' } } })
  if (values.help) console.log('Usage: host:stage --product-dir VERIFIED-PRODUCT. Creates a new distribution directory only; never installs or updates host accounts.')
  else { if (!values['product-dir']) throw Error('--product-dir is required'); console.log(JSON.stringify({ ok: true, ...await stageHosts(values['product-dir']) })) }
}
