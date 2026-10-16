#!/usr/bin/env node
/** Release gate: reject incomplete Electron layouts or incorrectly named output. */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const require = createRequire(import.meta.url)
const version = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version
const release = path.join(root, 'release')
const requested = new Set(process.argv.slice(2))
const requiredCore = ['chrome_100_percent.pak', 'chrome_200_percent.pak', 'dxcompiler.dll', 'libEGL.dll', 'libGLESv2.dll', 'ModCrafting.exe']
const directoryIndex = process.argv.indexOf('--dir')
if (directoryIndex !== -1 && (!process.argv[directoryIndex + 1] || process.argv[directoryIndex + 1].startsWith('--'))) {
  throw new Error('--dir requires a win-unpacked directory')
}
const unpacked = directoryIndex === -1 ? path.join(release, 'win-unpacked') : path.resolve(process.argv[directoryIndex + 1])

function fail(message) {
  console.error(`[package-verify] ${message}`)
  process.exitCode = 1
}

for (const name of requiredCore) {
  if (!existsSync(path.join(unpacked, name))) fail(`Electron core file missing: win-unpacked/${name}`)
}

// electron-updater loads js-yaml from the main process. Check the ASAR
// manifest instead of discovering a missing transitive production dependency
// only after the installer has reached users.
const asarPath = path.join(unpacked, 'resources', 'app.asar')
if (existsSync(asarPath)) {
  try {
    const asar = require('@electron/asar')
    const files = asar.listPackage(asarPath)
    const listed = files.join('\n')
    for (const dependency of ['node_modules\\electron-updater', 'node_modules\\js-yaml', 'node_modules\\unzipper', 'node_modules\\duplexer2']) {
      if (!listed.includes(dependency)) fail(`Required main-process dependency missing from app.asar: ${dependency}`)
    }
    // Check Node's nested-then-root resolution order and the declared range.
    const candidates = ['node_modules/duplexer2/node_modules/readable-stream/package.json', 'node_modules/readable-stream/package.json']
    const normalized = new Set(files.map((file) => file.replaceAll('\\', '/').replace(/^\//, '')))
    const readable = candidates.find((file) => normalized.has(file))
    if (!readable) {
      fail('Required unzipper runtime dependency missing from app.asar: readable-stream')
    } else {
      const metadata = (file) => JSON.parse(asar.extractFile(asarPath, path.normalize(file)).toString('utf8'))
      const range = metadata('node_modules/duplexer2/package.json').dependencies['readable-stream']
      const actual = metadata(readable).version
      if (!require('semver').satisfies(actual, range)) fail(`Packaged duplexer2 requires readable-stream ${range}, found ${actual}`)
    }
  } catch (error) {
    fail(`Unable to inspect app.asar dependencies: ${error instanceof Error ? error.message : String(error)}`)
  }
}

const setupName = `ModCrafting-Setup-${version}.exe`
const portableName = `ModCrafting-${version}-Portable.exe`
const setupPath = path.join(release, setupName)
const portablePath = path.join(release, portableName)
if (directoryIndex === -1 && !requested.has('--portable') && !existsSync(setupPath)) fail(`Setup artifact missing: ${setupName}`)
if (directoryIndex === -1 && !requested.has('--setup') && !existsSync(portablePath)) fail(`Portable artifact missing: ${portableName}`)

if (existsSync(setupPath) && statSync(setupPath).size >= 100_000_000) {
  fail(`Setup is ${statSync(setupPath).size} bytes, exceeding the 100,000,000 byte release limit`)
}

const latestPath = path.join(release, 'latest.yml')
if (existsSync(latestPath)) {
  const latest = readFileSync(latestPath, 'utf8')
  if (!latest.includes(`path: ${setupName}`)) fail('latest.yml does not reference the canonical Setup filename')
  if (!/^sha512:\s*\S+/m.test(latest)) fail('latest.yml is missing sha512')
}

if (!process.exitCode) console.log(`[package-verify] Windows x64 ${directoryIndex === -1 ? 'artifacts' : 'unpacked layout'} passed (${version})`)
