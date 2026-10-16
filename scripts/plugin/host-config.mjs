#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { existsSync, lstatSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export function renderHostConfig({ host, pluginDirectory, dataRoot, node = 'node', web = false }) {
  if (!['codex', 'claude', 'qoder'].includes(host)) throw Error('Choose codex, claude or qoder')
  for (const [label, value] of Object.entries({ pluginDirectory, dataRoot })) {
    if (typeof value !== 'string' || !path.isAbsolute(value) || !value.trim()) throw Error(`${label} must be an absolute path`)
  }
  if (node !== 'node' && !path.isAbsolute(node)) throw Error('node must be node or an absolute executable path')
  const directory = path.resolve(pluginDirectory), data = path.resolve(dataRoot)
  const relative = path.relative(directory, data)
  if (!relative || relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) throw Error('Keep dataRoot outside the install directory so upgrades preserve data')
  const server = { command: node, args: [path.join(directory, 'dist/mcp-server.js'), ...(web ? ['--web'] : [])], cwd: directory, env: { MODCRAFTING_DATA: data } }
  if (host !== 'codex') return JSON.stringify({ mcpServers: { 'modcrafting-fabric': { type: 'stdio', ...server } } }, null, 2) + '\n'
  return `[mcp_servers.modcrafting-fabric]\ncommand = ${JSON.stringify(server.command)}\nargs = ${JSON.stringify(server.args)}\ncwd = ${JSON.stringify(server.cwd)}\n\n[mcp_servers.modcrafting-fabric.env]\nMODCRAFTING_DATA = ${JSON.stringify(data)}\n`
}

export function writeHostConfig(options, output) {
  if (!path.isAbsolute(output)) throw Error('output must be an absolute new file path')
  const entry = path.join(options.pluginDirectory, 'dist/mcp-server.js')
  if (!existsSync(entry) || !lstatSync(entry).isFile() || lstatSync(entry).isSymbolicLink()) throw Error('Use a complete staged plugin containing dist/mcp-server.js')
  let ancestor = path.resolve(output)
  while (true) {
    if (existsSync(ancestor) && lstatSync(ancestor).isSymbolicLink()) throw Error('Output must not traverse a junction/symlink')
    const parent = path.dirname(ancestor); if (parent === ancestor) break; ancestor = parent
  }
  const content = renderHostConfig(options)
  mkdirSync(path.dirname(output), { recursive: true })
  writeFileSync(output, content, { flag: 'wx' })
  return output
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { host: { type: 'string' }, 'plugin-dir': { type: 'string' }, 'data-root': { type: 'string' }, node: { type: 'string' }, output: { type: 'string' }, web: { type: 'boolean' }, help: { type: 'boolean' } } })
  if (values.help) console.log('Usage: host-config --host codex|claude|qoder --plugin-dir ABSOLUTE --data-root ABSOLUTE --output NEW-ABSOLUTE-FILE [--node ABSOLUTE-EXE] [--web]. Generates a file only; never installs or edits host profiles.')
  else {
    if (!values.host || !values['plugin-dir'] || !values['data-root'] || !values.output) throw Error('host, plugin-dir, data-root and output are required')
    writeHostConfig({ host: values.host, pluginDirectory: values['plugin-dir'], dataRoot: values['data-root'], node: values.node, web: values.web }, values.output)
    console.log(JSON.stringify({ ok: true, host: values.host, output: values.output, installed: false }))
  }
}
