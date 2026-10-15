import { existsSync, readdirSync, readFileSync, lstatSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export function validatePlugin(pluginRoot, staged = false) {
  const manifest = JSON.parse(readFileSync(path.join(pluginRoot, '.codex-plugin/plugin.json'), 'utf8'))
  const config = JSON.parse(readFileSync(path.join(pluginRoot, '.mcp.json'), 'utf8'))
  const required = ['.codex-plugin/plugin.json', '.mcp.json', 'dist/mcp-server.js', 'assets/modcrafting.png', 'README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.txt']
  for (const key of ['name', 'version', 'description', 'license']) {
    if (typeof manifest[key] !== 'string' || !manifest[key].trim()) throw new Error(`Invalid manifest.${key}`)
  }
  if (manifest.name !== 'modcrafting-fabric' || manifest.license !== 'GPL-3.0' || !manifest.author?.name) throw new Error('Invalid plugin identity/license/author')
  if (manifest.skills !== './skills/' || manifest.mcpServers !== './.mcp.json') throw new Error('Invalid manifest paths')
  for (const icon of [manifest.interface?.composerIcon, manifest.interface?.logo]) {
    if (icon !== './assets/modcrafting.png') throw new Error('Invalid manifest icon')
  }
  const server = config.mcpServers?.['modcrafting-fabric']
  if (Object.keys(server?.env || {}).length) throw new Error('Packaged MCP config must not contain local environment overrides')
  if (server?.command !== 'node' || server.cwd !== '.' || JSON.stringify(server.args) !== JSON.stringify(['./dist/mcp-server.js'])) throw new Error('MCP entry must refer to the packaged JS through plugin-relative cwd')
  for (const entry of readdirSync(path.join(pluginRoot, 'skills'), { withFileTypes: true })) {
    if (!entry.isDirectory()) throw new Error('Unexpected skill entry')
    const file = `skills/${entry.name}/SKILL.md`
    if (!readFileSync(path.join(pluginRoot, file), 'utf8').startsWith('---')) throw new Error(`Invalid skill: ${file}`)
    required.push(file)
  }
  for (const file of required) if (!existsSync(path.join(pluginRoot, file)) || !lstatSync(path.join(pluginRoot, file)).isFile()) throw new Error(`Missing regular file: ${file}`)
  const personalPath = /[A-Za-z]:[\\/](?:Users|project_file)\b|\/home\/[^/]+\//
  const bundle = readFileSync(path.join(pluginRoot, 'dist/mcp-server.js'), 'utf8')
  if (!bundle.includes(JSON.stringify(manifest.version))) throw new Error('Bundle version differs from manifest')
  if (personalPath.test(bundle)) throw new Error('Bundle contains a personal absolute path')
  if (staged) validateStageContents(pluginRoot, required)
  return { manifest, config }
}

export function validateStageContents(pluginRoot, required) {
    const personalPath = /[A-Za-z]:[\\/](?:Users|project_file)\b|\/home\/[^/]+\//
    const walk = (dir, prefix = '') => {
      for (const entry of readdirSync(dir)) {
        const relative = `${prefix}${entry}`
        const stat = lstatSync(path.join(dir, entry))
        if (stat.isSymbolicLink()) throw new Error(`Stage contains a link: ${relative}`)
        if (stat.isDirectory()) {
          if (!required.some((file) => file.startsWith(`${relative}/`))) throw new Error(`Stage contains unexpected directory: ${relative}`)
          walk(path.join(dir, entry), `${relative}/`)
        } else if (!required.includes(relative)) throw new Error(`Stage contains unexpected file: ${relative}`)
        else if (!relative.endsWith('.png') && personalPath.test(readFileSync(path.join(dir, entry), 'utf8'))) throw new Error(`Stage contains a personal absolute path: ${relative}`)
      }
    }
    walk(pluginRoot)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = path.resolve(process.argv[2] || 'plugins/modcrafting-fabric')
  validatePlugin(target, process.argv.includes('--stage'))
  console.log('Plugin validation passed: modcrafting-fabric')
}
