import { build } from 'esbuild'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const result = await build({ entryPoints: [path.join(root, 'scripts/plugin/migrate-desktop.ts')], outfile: path.join(root, 'temp/migration-artifacts/migrate-desktop.mjs'), bundle: true, platform: 'node', target: 'node22', format: 'esm', packages: 'bundle', metafile: true })
if (Object.keys(result.metafile.inputs).some((file) => file.replace(/\\/g, '/').startsWith('src/')) || Object.values(result.metafile.outputs).some((output) => output.imports.some((item) => item.external && !item.path.startsWith('node:')))) throw Error('Migration command must not import Desktop or non-builtin runtime modules')
console.log('Built standalone migration CLI: temp/migration-artifacts/migrate-desktop.mjs')
