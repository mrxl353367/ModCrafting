#!/usr/bin/env node
/** Launch the actual packaged app with an isolated profile and a hard timeout. */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const executable = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'release', 'win-unpacked', 'ModCrafting.exe')
if (process.platform !== 'win32' || !existsSync(executable)) throw new Error('A packaged Windows ModCrafting.exe is required')
const parent = path.join(root, 'temp', 'packaged-smoke')
mkdirSync(parent, { recursive: true })
const artifacts = mkdtempSync(path.join(parent, 'run-'))
const profile = path.join(artifacts, 'profile')
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
const started = Date.now()
let stdout = '', stderr = '', timedOut = false
const child = spawn(executable, ['--automation', '--automation-hidden', '--automation-profile', profile, '--smoke-test'], {
  cwd: path.dirname(executable), env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
})
child.stdout.on('data', (chunk) => { stdout += chunk })
child.stderr.on('data', (chunk) => { stderr += chunk })
child.on('error', (error) => { stderr += error.message })
const timer = setTimeout(() => {
  timedOut = true
  // Kill only this test's process tree while its parent PID is still alive.
  if (child.pid && child.exitCode === null) {
    const stopped = spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
    if (stopped.status !== 0) child.kill('SIGKILL')
  }
}, 15000)
const exitCode = await new Promise((resolve) => child.once('close', resolve))
clearTimeout(timer)
const ready = stdout.includes('[smoke-test] renderer, preload IPC and packaged resources are ready')
const summary = { ok: exitCode === 0 && ready && !timedOut, exitCode, timedOut, ready, elapsedMs: Date.now() - started }
writeFileSync(path.join(artifacts, 'stdout.log'), stdout)
writeFileSync(path.join(artifacts, 'stderr.log'), stderr)
writeFileSync(path.join(artifacts, 'result.json'), JSON.stringify(summary, null, 2))
console.log(JSON.stringify({ ...summary, artifacts }))
if (!summary.ok) process.exitCode = 1
