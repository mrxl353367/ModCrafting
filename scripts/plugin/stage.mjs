import { cp, mkdir, readdir, lstat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validatePlugin, validateStageContents } from './validate.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const source = path.join(root, 'plugins/modcrafting-fabric')
const destination = path.join(root, 'temp/plugin-artifacts/modcrafting-fabric')
const entries = ['.codex-plugin/plugin.json', '.mcp.json', 'dist/mcp-server.js', 'assets/modcrafting.png', 'README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.txt']
// Only SKILL.md files are part of the current two skills; never copy caches or adjacent local files.
for (const entry of await readdir(path.join(source, 'skills'), { withFileTypes: true })) {
  if (entry.isDirectory()) entries.push(`skills/${entry.name}/SKILL.md`)
}
validatePlugin(source)
// Refuse unexpected files or junctions in a previous stage instead of deleting user files.
for (const directory of [path.join(root, 'temp'), path.join(root, 'temp/plugin-artifacts'), destination]) {
  if (existsSync(directory) && (await lstat(directory)).isSymbolicLink()) throw new Error('Stage path must not traverse a junction/symlink')
}
if (existsSync(destination)) validateStageContents(destination, entries)
for (const relative of entries) {
  const target = path.join(destination, relative)
  if (existsSync(target) && (await lstat(target)).nlink > 1) throw new Error(`Refusing to overwrite a hard-linked stage file: ${relative}`)
  if (!(await lstat(path.join(source, relative))).isFile()) throw new Error(`Not a regular file: ${relative}`)
  await mkdir(path.dirname(path.join(destination, relative)), { recursive: true })
  await cp(path.join(source, relative), path.join(destination, relative))
}
validatePlugin(destination, true)
console.log(`Staged independent plugin: ${path.relative(root, destination)}`)
