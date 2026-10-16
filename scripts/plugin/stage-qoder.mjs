import { cp, mkdir, mkdtemp, readFile, readdir, lstat, realpath, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const sha = value => createHash('sha256').update(value).digest('hex')
const inside = (parent, child) => { const rel = path.relative(parent, child); return !rel || !path.isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${path.sep}`) }

async function files(directory, prefix = '') {
  if ((await lstat(directory)).isSymbolicLink()) throw Error('Package inputs must not be links')
  const result = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name), relative = `${prefix}${entry.name}`
    if (entry.isSymbolicLink()) throw Error(`Package input is a link: ${relative}`)
    if (entry.isDirectory()) result.push(...await files(file, `${relative}/`))
    else if (entry.isFile()) result.push(relative)
    else throw Error(`Not an ordinary file: ${relative}`)
  }
  return result.sort()
}

export async function stageQoder({ source, outputRoot = path.join(root, 'temp/qoder-artifacts'), dataRoot, node } = {}) {
  outputRoot = path.resolve(outputRoot)
  if (!source || !path.isAbsolute(source)) throw Error('--source must be an absolute built candidate directory')
  if (dataRoot && !path.isAbsolute(dataRoot)) throw Error('--data-root must be absolute')
  if (node && !path.isAbsolute(node)) throw Error('--node must be an absolute executable path')
  const input = await realpath(source)
  await files(source)
  if (inside(input, path.resolve(outputRoot))) throw Error('Output must be outside the source package')
  // Follow existing parent directories before creating output, including Windows junctions.
  let existing = path.resolve(outputRoot)
  while (true) {
    try { if (inside(input, await realpath(existing))) throw Error('Output resolves inside the source package'); break }
    catch (error) { if (error.code !== 'ENOENT') throw error; existing = path.dirname(existing) }
  }
  if (dataRoot && inside(input, path.resolve(dataRoot))) throw Error('Data must be outside the source package')
  const identity = JSON.parse(await readFile(path.join(input, '.codex-plugin/plugin.json'), 'utf8'))
  if (identity.name !== 'modcrafting-fabric' || typeof identity.version !== 'string') throw Error('Not a ModCrafting candidate')
  const bundle = await readFile(path.join(input, 'dist/mcp-server.js'))
  if (!bundle.toString().includes('--web')) throw Error('Use a current candidate with browser support')
  for (const name of ['fabric-mod-development', 'fabric-game-validation']) {
    const skill = await readFile(path.join(input, 'skills', name, 'SKILL.md'), 'utf8')
    if (!/^---\r?\n[\s\S]*?\bname:[\s\S]*?\bdescription:[\s\S]*?\r?\n---/m.test(skill)) throw Error(`Invalid skill: ${name}`)
  }
  for (const name of ['LICENSE', 'THIRD_PARTY_NOTICES.txt', 'assets/modcrafting.png']) await readFile(path.join(input, name))
  await mkdir(outputRoot, { recursive: true })
  const directory = await mkdtemp(path.join(outputRoot, 'modcrafting-'))
  const plugin = path.join(directory, identity.name)
  await mkdir(path.join(plugin, '.qoder-plugin'), { recursive: true })
  for (const name of ['dist', 'skills', 'assets', 'LICENSE', 'THIRD_PARTY_NOTICES.txt']) {
    await cp(path.join(input, name), path.join(plugin, name), { recursive: true, force: false, errorOnExist: true })
  }
  await cp(path.join(root, 'plugins/modcrafting-qoder/commands'), path.join(plugin, 'commands'), { recursive: true })
  const { name, version, author, homepage, repository, license } = identity
  const manifest = {
    name, displayName: 'ModCrafting Fabric', version: version.replace('+desktop.', '+qoder.'),
    description: 'Develop and validate Fabric 1.21.4 mods with Qoder.',
    descriptionZh: '通过技能、命令、可视化工作台与游戏测试完成 Fabric 模组开发。',
    author, homepage, repository, license, logo: './assets/modcrafting.png',
    skills: './skills/', commands: './commands/', mcpServers: './.mcp.json'
  }
  await writeFile(path.join(plugin, '.qoder-plugin/plugin.json'), JSON.stringify(manifest, null, 2) + '\n')
  await writeFile(path.join(plugin, '.mcp.json'), JSON.stringify({ mcpServers: { 'modcrafting-fabric': {
    command: node || 'node', args: ['${QODER_PLUGIN_ROOT}/dist/mcp-server.js', '--web'],
    env: { MODCRAFTING_DATA: dataRoot || '${QODER_PLUGIN_DATA}' }
  } } }, null, 2) + '\n')
  await cp(path.join(root, 'docs/qoder-user-guide.md'), path.join(plugin, 'README.md'))
  const fingerprints = {}
  for (const file of await files(plugin)) fingerprints[file] = sha(await readFile(path.join(plugin, file)))
  await writeFile(path.join(directory, 'manifest.json'), JSON.stringify({
    version: manifest.version, sourceVersion: version, coreBundleSha256: sha(bundle),
    machineSpecific: Boolean(dataRoot || node), files: fingerprints
  }, null, 2) + '\n')
  const zip = path.join(directory, `${name}-qoder.zip`)
  // Windows built-in ZIP support preserves the .qoder-plugin root; no new npm dependency.
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    'Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory($env:MODCRAFTING_ZIP_SOURCE, $env:MODCRAFTING_ZIP_TARGET)'],
  { env: { ...process.env, MODCRAFTING_ZIP_SOURCE: plugin, MODCRAFTING_ZIP_TARGET: zip }, windowsHide: true, stdio: 'pipe' })
  return { directory, plugin, zip, version: manifest.version, coreBundleSha256: sha(bundle), machineSpecific: Boolean(dataRoot || node) }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { source: { type: 'string' }, 'output-root': { type: 'string' }, 'data-root': { type: 'string' }, node: { type: 'string' }, help: { type: 'boolean' } } })
  if (values.help) console.log('Usage: plugin:qoder --source ABSOLUTE-BUILT-CANDIDATE [--output-root DIRECTORY] [--data-root ABSOLUTE] [--node ABSOLUTE]. Creates a native desktop plugin ZIP; does not install or edit host settings.')
  else console.log(JSON.stringify(await stageQoder({ source: values.source, outputRoot: values['output-root'], dataRoot: values['data-root'], node: values.node }), null, 2))
}
