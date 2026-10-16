#!/usr/bin/env node
/** Restore esbuild only by default; explicit --desktop also checks/restores Electron. */
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const root = process.cwd()

function verifyElectron() {
  try {
    const binary = require('electron')
    return existsSync(binary) && spawnSync(binary, ['--version'], {
      cwd: root, encoding: 'utf8', windowsHide: true, timeout: 15000,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
    }).status === 0
  } catch { return false }
}

function verifyEsbuild() {
  try {
    require('esbuild').transformSync('const ready = true', { loader: 'js' })
    return true
  } catch { return false }
}

let failed = false
for (const [name, verify] of [...(process.argv.includes('--desktop') ? [['electron', verifyElectron]] : []), ['esbuild', verifyEsbuild]]) {
  if (!verify()) {
    console.log(`[postinstall] Restoring ${name} binary`)
    const install = join(dirname(require.resolve(`${name}/package.json`)), 'install.js')
    const result = spawnSync(process.execPath, [install], { cwd: root, stdio: 'inherit', windowsHide: true })
    if (result.status !== 0 || !verify()) {
      console.error(`[postinstall] ${name} is not executable; repair the approved dependency installation`)
      failed = true
    }
  }
}
if (failed) process.exit(1)
