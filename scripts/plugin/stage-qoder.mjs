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

export async function stageQoder({ source, outputRoot = path.join(root, 'temp/qoder-artifacts'), dataRoot, node, gradleHome } = {}) {
  outputRoot = path.resolve(outputRoot)
  if (!source || !path.isAbsolute(source)) throw Error('--source must be an absolute built candidate directory')
  if (dataRoot && !path.isAbsolute(dataRoot)) throw Error('--data-root must be absolute')
  if (node && !path.isAbsolute(node)) throw Error('--node must be an absolute executable path')
  if (gradleHome && !path.isAbsolute(gradleHome)) throw Error('--gradle-home must be an absolute cache directory')
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
  const compatibility = JSON.parse(await readFile(path.join(input, 'compatibility.json'), 'utf8'))
  if (compatibility.contractVersion !== 1 || compatibility.version !== identity.version || compatibility.minecraft !== '1.21.4' || compatibility.observer?.protocol !== 2 || !/^[a-f0-9]{64}$/.test(compatibility.observer?.sha256 || '') || compatibility.coreBundleSha256 !== sha(bundle)) throw Error('Use a complete current build with a matching Observer V2 and bundle fingerprint')
  if (!bundle.toString().includes('modcrafting_open_workbench')) throw Error('Use a current candidate with workbench opening support')
  for (const name of ['modcrafting-start', 'fabric-mod-development', 'fabric-game-validation']) {
    const skill = await readFile(path.join(input, 'skills', name, 'SKILL.md'), 'utf8')
    if (!/^---\r?\n[\s\S]*?\bname:[\s\S]*?\bdescription:[\s\S]*?\r?\n---/m.test(skill)) throw Error(`Invalid skill: ${name}`)
  }
  for (const name of ['LICENSE', 'THIRD_PARTY_NOTICES.txt', 'assets/modcrafting.png']) await readFile(path.join(input, name))
  await mkdir(outputRoot, { recursive: true })
  const directory = await mkdtemp(path.join(outputRoot, 'modcrafting-'))
  const plugin = path.join(directory, identity.name)
  await mkdir(path.join(plugin, '.qoder-plugin'), { recursive: true })
  for (const name of ['dist', 'skills', 'assets', 'LICENSE', 'THIRD_PARTY_NOTICES.txt', 'compatibility.json']) {
    await cp(path.join(input, name), path.join(plugin, name), { recursive: true, force: false, errorOnExist: true })
  }
  await cp(path.join(root, 'plugins/modcrafting-qoder/commands'), path.join(plugin, 'commands'), { recursive: true })
  const { name, version, author, homepage, repository, license } = identity
  const manifest = {
    name, displayName: 'ModCrafting Fabric', version: version.replace(/\+(?:desktop|codex)\./, '+qoder.'),
    description: 'Develop and validate Fabric 1.21.4 mods with Qoder.',
    descriptionZh: '通过技能、命令、可视化工作台与游戏测试完成 Fabric 模组开发。',
    author, homepage, repository, license, logo: './assets/modcrafting.png',
    skills: './skills/', commands: './commands/', mcpServers: './.mcp.json'
  }
  await writeFile(path.join(plugin, '.qoder-plugin/plugin.json'), JSON.stringify(manifest, null, 2) + '\n')
  await writeFile(path.join(plugin, '.mcp.json'), JSON.stringify({ mcpServers: { 'modcrafting-fabric': {
    command: node || 'node', args: ['${QODER_PLUGIN_ROOT}/dist/mcp-server.js', '--web'],
    env: { MODCRAFTING_DATA: dataRoot || '${QODER_PLUGIN_DATA}', ...(gradleHome ? { GRADLE_USER_HOME: gradleHome } : {}) }
  } } }, null, 2) + '\n')
  await cp(path.join(root, 'docs/qoder-user-guide.md'), path.join(plugin, 'README.md'))
  const fingerprints = {}
  for (const file of await files(plugin)) fingerprints[file] = sha(await readFile(path.join(plugin, file)))
  await writeFile(path.join(directory, 'manifest.json'), JSON.stringify({
    version: manifest.version, sourceVersion: version, coreBundleSha256: sha(bundle),
    machineSpecific: Boolean(dataRoot || node || gradleHome), files: fingerprints
  }, null, 2) + '\n')
  const zip = path.join(directory, `${name}-qoder.zip`)
  createPortableZip(plugin, zip)
  return { directory, plugin, zip, version: manifest.version, coreBundleSha256: sha(bundle), machineSpecific: Boolean(dataRoot || node || gradleHome) }
}

export function createPortableZip(source, target) {
  if (process.platform !== 'win32') throw Error('Portable ZIP creation currently requires Windows PowerShell')
  source = path.resolve(source); target = path.resolve(target)
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    "$ErrorActionPreference = 'Stop'; Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem; $archive = [System.IO.Compression.ZipFile]::Open($env:MODCRAFTING_ZIP_TARGET, [System.IO.Compression.ZipArchiveMode]::Create); try { Get-ChildItem -LiteralPath $env:MODCRAFTING_ZIP_SOURCE -Recurse -File -Force | ForEach-Object { $relative = $_.FullName.Substring($env:MODCRAFTING_ZIP_SOURCE.Length + 1).Replace('\\', '/'); [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $_.FullName, $relative, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null } } finally { $archive.Dispose() }"],
  { env: { ...process.env, MODCRAFTING_ZIP_SOURCE: source, MODCRAFTING_ZIP_TARGET: target }, windowsHide: true, stdio: 'pipe' })
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { source: { type: 'string' }, 'output-root': { type: 'string' }, 'data-root': { type: 'string' }, node: { type: 'string' }, 'gradle-home': { type: 'string' }, help: { type: 'boolean' } } })
  if (values.help) console.log('Usage: plugin:qoder --source ABSOLUTE-BUILT-CANDIDATE [--output-root DIRECTORY] [--data-root ABSOLUTE] [--node ABSOLUTE] [--gradle-home ABSOLUTE]. Creates a native desktop plugin ZIP; does not install or edit host settings.')
  else console.log(JSON.stringify(await stageQoder({ source: values.source, outputRoot: values['output-root'], dataRoot: values['data-root'], node: values.node, gradleHome: values['gradle-home'] }), null, 2))
}
