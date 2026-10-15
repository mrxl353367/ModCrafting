#!/usr/bin/env node
import { build } from 'esbuild'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const plugin = path.join(root, 'plugins', 'modcrafting-fabric')
const dist = path.join(plugin, 'dist')
const manifest = JSON.parse(await readFile(path.join(plugin, '.codex-plugin/plugin.json'), 'utf8'))
const wrapper = { batch: (await readFile(path.join(root, 'bridge-mod/gradlew.bat'), 'utf8')).replace(/\r?\n/g, '\r\n'), properties: (await readFile(path.join(root, 'bridge-mod/gradle/wrapper/gradle-wrapper.properties'), 'utf8')).replace(/\r\n/g, '\n'), jarBase64: (await readFile(path.join(root, 'bridge-mod/gradle/wrapper/gradle-wrapper.jar'))).toString('base64') }
await mkdir(dist, { recursive: true })
// Embed the optional React view in the existing self-contained entry; Stage stays nine files.
const view = await build({ entryPoints: [path.join(root, 'packages/modcrafting-view/src/main.tsx')], absWorkingDir: root, bundle: true, platform: 'browser', format: 'esm', target: 'es2023', minify: true, legalComments: 'eof', define: { 'process.env.NODE_ENV': '"production"' }, write: false, metafile: true })
if (Object.values(view.metafile.outputs).some((output) => output.imports.some((entry) => entry.external))) throw Error('Browser view has an external runtime dependency')
const webAssets = {
  html: '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ModCrafting · Fabric 工作台</title><link rel="stylesheet" href="/view.css"></head><body><div id="root"></div><script type="module" src="/view.js"></script></body></html>',
  js: view.outputFiles[0].text,
  css: await readFile(path.join(root, 'packages/modcrafting-view/src/view.css'), 'utf8')
}
const bundled = await build({
  entryPoints: [path.join(plugin, 'src', 'mcp-server.ts')],
  absWorkingDir: root,
  outfile: path.join(dist, 'mcp-server.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: false,
  legalComments: 'eof',
  define: { __PLUGIN_VERSION__: JSON.stringify(manifest.version), __WEB_ASSETS__: JSON.stringify(webAssets), __PROJECT_WRAPPER__: JSON.stringify(wrapper) },
  metafile: true,
  write: false
})
for (const output of Object.values(bundled.metafile.outputs)) {
  if (output.imports.some((entry) => entry.external && !entry.path.startsWith('node:'))) throw new Error('Bundle has a non-builtin external dependency')
}
await writeFile(path.join(dist, 'mcp-server.js'), bundled.outputFiles[0].contents)
const licenses = new Map()
for (const input of [...Object.keys(bundled.metafile.inputs), ...Object.keys(view.metafile.inputs)].filter((file) => file.replace(/\\/g, '/').includes('node_modules/'))) {
  let directory = path.dirname(path.resolve(root, input))
  while (directory !== root && path.dirname(directory) !== directory) {
    const metadata = path.join(directory, 'package.json')
    if (existsSync(metadata)) {
      const pkg = JSON.parse(await readFile(metadata, 'utf8'))
      if (pkg.name && pkg.version) {
        const license = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license'].map((name) => path.join(directory, name)).find(existsSync)
        if (!license) throw new Error(`Bundled package license missing: ${pkg.name}`)
        licenses.set(`${pkg.name}@${pkg.version}`, await readFile(license, 'utf8'))
        break
      }
    }
    directory = path.dirname(directory)
  }
}
licenses.set('Gradle Wrapper (Apache-2.0)', await readFile(path.join(root, 'bridge-mod/gradle/wrapper/LICENSE'), 'utf8'))
await writeFile(path.join(plugin, 'THIRD_PARTY_NOTICES.txt'), [...licenses].map(([name, license]) => `${name}\n${license}`).join('\n\n'))
await mkdir(path.join(plugin, 'assets'), { recursive: true })
await copyFile(path.join(root, 'packaging', 'appIcon.png'), path.join(plugin, 'assets', 'modcrafting.png'))
console.log(`Built self-contained ModCrafting Fabric MCP: ${path.relative(root, path.join(dist, 'mcp-server.js'))}`)
