#!/usr/bin/env node
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import sharp from 'sharp'
import { transformSync } from 'esbuild'

const require = createRequire(import.meta.url)
assert.match(transformSync('const ready: boolean = true', { loader: 'ts' }).code, /ready/)
const image = await sharp({ create: { width: 2, height: 2, channels: 4, background: '#ffffff' } }).png().toBuffer()
assert.equal((await sharp(image).metadata()).width, 2)
// Different libvips versions cannot safely coexist in one Windows process.
const legacy = spawnSync(process.execPath, ['-e', `
  const { createRequire } = require('node:module')
  const sharp = createRequire(require.resolve('@xenova/transformers'))('sharp')
  sharp({ create: { width: 1, height: 1, channels: 3, background: '#ffffff' } }).png().toBuffer()
    .catch(error => { console.error(error); process.exit(1) })
`], { cwd: process.cwd(), encoding: 'utf8', windowsHide: true, timeout: 15000 })
assert.equal(legacy.status, 0, legacy.stderr)

const parent = path.resolve('temp', 'native-verification')
mkdirSync(parent, { recursive: true })
const directory = mkdtempSync(path.join(parent, 'run-'))
const script = path.join(directory, 'electron-smoke.cjs')
writeFileSync(script, `
const { app, BrowserWindow } = require('electron')
const pty = require('node-pty')
app.setPath('userData', __dirname + '/user-data')
app.setPath('sessionData', __dirname + '/session-data')
app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })
  await window.loadURL('data:text/html,<title>pnpm dependency smoke</title>')
  const terminal = pty.spawn(process.argv[2], ['-e', 'console.log("NATIVE_PTY_READY")'], {
    cwd: __dirname, env: { ...process.env }, cols: 80, rows: 24
  })
  let output = ''
  terminal.onData(chunk => { output += chunk })
  terminal.onExit(({ exitCode }) => {
    window.destroy()
    if (exitCode !== 0 || !output.includes('NATIVE_PTY_READY')) app.exit(1)
    else { console.log(JSON.stringify({ electron: process.versions.electron, nodePty: true, renderer: true })); app.exit(0) }
  })
}).catch(error => { console.error(error); app.exit(1) })
`)
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
const child = spawnSync(require('electron'), [script, process.execPath], {
  cwd: directory, env, encoding: 'utf8', windowsHide: true, timeout: 30000
})
assert.equal(child.error, undefined, child.error?.message)
assert.equal(child.status, 0, child.stderr)
assert.equal(JSON.parse(child.stdout.trim()).nodePty, true)
console.log(JSON.stringify({ ok: true, esbuild: true, sharp: true, legacySharp: true, ...JSON.parse(child.stdout.trim()) }))
