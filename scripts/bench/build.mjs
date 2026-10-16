import { build } from 'esbuild'
import { copyFile, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const outputRoot = path.join(root, 'temp/bench-artifacts')
await mkdir(outputRoot, { recursive: true })
const directory = await mkdtemp(path.join(outputRoot, 'fabric-bench-'))
const manifest = { version: 1, node: '22.15+ or 24', platform: 'Windows x64 (live)', files: {}, sourceHashes: {} }
for (const entry of ['run-fabric-bench', 'run-fabric-bench-live']) {
  const bundled = await build({ entryPoints: [`scripts/bench/${entry}.ts`], absWorkingDir: root, bundle: true, platform: 'node', format: 'esm', target: 'node22', sourcemap: false, legalComments: 'eof', write: false, metafile: true, outfile: path.join(directory, `${entry}.mjs`) })
  for (const output of Object.values(bundled.metafile.outputs)) if (output.imports.some((value) => value.external && !value.path.startsWith('node:'))) throw Error('Bench bundle has a non-builtin external dependency')
  for (const file of Object.keys(bundled.metafile.inputs)) {
    const normalized = file.replace(/\\/g, '/')
    if (normalized.startsWith('src/') || normalized.includes('electron')) throw Error('Desktop input found in Bench bundle')
    if (normalized.includes('node_modules/')) {
      if (!normalized.startsWith('node_modules/zod/')) throw Error(`Unexpected bundled dependency: ${normalized}`)
    } else manifest.sourceHashes[normalized] = sha256(await readFile(path.join(root, file)))
  }
  const contents = bundled.outputFiles[0].contents
  await writeFile(path.join(directory, `${entry}.mjs`), contents, { flag: 'wx' }); manifest.files[`${entry}.mjs`] = sha256(contents)
}
for (const [source, destination] of [['scripts/bench/fabric-bench-mvp.json', 'fabric-bench-mvp.json'], ['scripts/bench/fabric-bench-live-mvp.json', 'fabric-bench-live-mvp.json'], ['docs/fabric-bench.md', 'README.md'], ['plugins/modcrafting-fabric/LICENSE', 'LICENSE']]) {
  await copyFile(path.join(root, source), path.join(directory, destination)); manifest.files[destination] = sha256(await readFile(path.join(directory, destination)))
}
const zod = JSON.parse(await readFile(path.join(root, 'node_modules/zod/package.json'), 'utf8'))
await writeFile(path.join(directory, 'THIRD_PARTY_NOTICES.txt'), `${zod.name}@${zod.version}\n${await readFile(path.join(root, 'node_modules/zod/LICENSE'), 'utf8')}`, { flag: 'wx' })
manifest.files['THIRD_PARTY_NOTICES.txt'] = sha256(await readFile(path.join(directory, 'THIRD_PARTY_NOTICES.txt')))
await writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2), { flag: 'wx' })
console.log(JSON.stringify({ ok: true, outputDirectory: directory, files: [...Object.keys(manifest.files), 'manifest.json'] }))
