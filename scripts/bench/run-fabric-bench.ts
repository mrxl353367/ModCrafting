import { readFile, writeFile, mkdtemp, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { runFabricBench } from '../../packages/modcrafting-core/src/fabric-bench.ts'
import { executionFingerprint, writeBenchReport } from './bench-support.ts'

const entry = fileURLToPath(import.meta.url)
const { values, positionals } = parseArgs({ allowPositionals: true, options: { mode: { type: 'string', default: 'fixture' }, 'run-root': { type: 'string' }, help: { type: 'boolean' } } })
if (values.help) { console.log('Usage: bench:fabric [suite.json] [--mode fixture] [--run-root output-directory]'); process.exit(0) }
if (values.mode !== 'fixture' || positionals.length > 1) throw Error('This command only accepts fixture suites; use bench:fabric:live for Minecraft')
const suiteFile = path.resolve(positionals[0] || path.join(path.dirname(entry), 'fabric-bench-mvp.json'))
const suite = await readFile(suiteFile, 'utf8')
const result = await runFabricBench(JSON.parse(suite))
const runtime = await executionFingerprint(entry, suite)
const outputRoot = path.resolve(values['run-root'] || 'temp/fabric-bench')
await mkdir(outputRoot, { recursive: true })
const directory = await mkdtemp(path.join(outputRoot, 'run-'))
await writeFile(path.join(directory, 'suite.json'), suite, { flag: 'wx' })
await writeBenchReport(directory, { ...result, runtime })
console.log(JSON.stringify({ execution: result.execution, ok: result.ok, counts: result.counts, reportDirectory: directory }))
process.exitCode = result.ok ? 0 : 1
