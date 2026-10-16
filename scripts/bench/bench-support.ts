import { cp, lstat, mkdir, mkdtemp, readFile, readdir, realpath, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import type { FabricBenchCaseResult } from '../../packages/modcrafting-core/src/fabric-bench.ts'

export interface BenchWidget { message?: string; label?: string; active?: boolean; className?: string; type?: string; x: number; y: number; width: number }
/** Save loading is asynchronous: observe an active Play button before invoking it. */
export async function selectBenchWorld(
  inspect: () => Promise<{ widgets: BenchWidget[] }>,
  input: (action: string, args: Record<string, unknown>) => Promise<void>,
  poll: <T>(work: () => Promise<T | undefined>, name: string) => Promise<T>
) {
  const play = await poll(async () => {
    const widgets = (await inspect()).widgets
    const button = widgets.find((row) => /进入.*世界/.test(row.message || row.label || ''))
    if (button?.active === true) return button
    const list = widgets.find((row) => String(row.className || row.type || '').includes('WorldList'))
    if (list) await input('click_at', { x: list.x + list.width / 2, y: list.y + 18 })
    return undefined
  }, 'active dedicated-world selection')
  await input('click_widget', { label: play.message || play.label! })
}

export const sha256 = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex')
const excluded = new Set(['.git', '.gradle', 'build', 'run', 'node_modules'])
const excludedName = (name: string) => excluded.has(name) || name === '.env' || name.startsWith('.env.')
const inside = (parent: string, child: string) => { const relative = path.relative(parent, child); return relative === '' || !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative) }

export async function copyBenchInput(source: string, target: string, project = false) {
  await cp(source, target, { recursive: true, errorOnExist: true, force: false, filter: async (file) => {
    if (project && path.relative(source, file).split(path.sep).some(excludedName)) return false
    if ((await lstat(file)).isSymbolicLink()) throw Error('Bench input must not contain symlinks or junctions')
    return true
  } })
}
/** Every run gets new writable copies; existing sources and worlds remain read-only inputs. */
export async function prepareBenchRun(project: string, runRoot: string, world?: string) {
  const source = await realpath(project)
  if (!(await lstat(source)).isDirectory()) throw Error('Project input must be a directory')
  if (world && (path.basename(world) !== 'ModCrafting Test World' || !(await lstat(path.join(world, 'level.dat'))).isFile())) throw Error('World input must be a dedicated ModCrafting Test World directory containing level.dat')
  let ancestor = path.resolve(runRoot), suffix: string[] = []
  while (true) {
    try { ancestor = await realpath(ancestor); break } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || path.dirname(ancestor) === ancestor) throw error
      suffix.unshift(path.basename(ancestor)); ancestor = path.dirname(ancestor)
    }
  }
  const output = path.join(ancestor, ...suffix)
  if (inside(source, output) || world && inside(await realpath(world), output)) throw Error('Run root must be outside all input directories')
  await mkdir(output, { recursive: true })
  const directory = await mkdtemp(path.join(output, 'run-'))
  const projectPath = path.join(directory, 'project'), gameDirectory = path.join(directory, 'game')
  await copyBenchInput(source, projectPath, true)
  await mkdir(gameDirectory)
  if (world) await copyBenchInput(world, path.join(gameDirectory, 'saves', 'ModCrafting Test World'))
  return { directory, projectPath, gameDirectory }
}
export async function hashTree(directory: string): Promise<Record<string, string>> {
  const hashes: Record<string, string> = {}
  const visit = async (current: string) => {
    for (const entry of (await readdir(current, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(current, entry.name)
      if (entry.isDirectory()) await visit(file)
      else if (entry.isFile()) hashes[path.relative(directory, file).replace(/\\/g, '/')] = sha256(await readFile(file))
      else throw Error('Fingerprint input must contain only ordinary files and directories')
    }
  }
  await visit(directory); return hashes
}
export async function executionFingerprint(entryFile: string, suite: string) {
  const fingerprint = { node: process.version, platform: process.platform, suiteSha256: sha256(suite), entrySha256: sha256(await readFile(entryFile)), sourceHashes: {} as Record<string, string> }
  if (entryFile.endsWith('.ts')) {
    const root = path.resolve(path.dirname(entryFile), '../..')
    for (const group of ['packages/modcrafting-core/src', 'scripts/bench']) {
      for (const entry of await readdir(path.join(root, group))) if (entry.endsWith('.ts')) fingerprint.sourceHashes[`${group}/${entry}`] = sha256(await readFile(path.join(root, group, entry)))
    }
  }
  return fingerprint
}
export async function writeBenchReport(directory: string, result: { execution: string; ok: boolean; counts: { total: number; matched: number }; cases: FabricBenchCaseResult[] } & Record<string, unknown>) {
  await writeFile(path.join(directory, 'report.json'), JSON.stringify(result, null, 2))
  await writeFile(path.join(directory, 'report.md'), `# Fabric-Bench ${result.execution}\n\nExpected verdict/code matched: ${result.counts.matched}/${result.counts.total}.\n\nActual verdict totals: ${JSON.stringify((result.counts as Record<string, unknown>).verdicts)}.\n\nRun OK: ${result.ok}.\n\n| Case | Expected | Actual | Cleanup | Matched |\n|---|---|---|---|---|\n${result.cases.map((row) => `| ${row.id} | ${row.expected.verdict}/${row.expected.code} | ${row.acceptance.verdict}/${row.acceptance.code} | ${row.acceptance.cleanup.status} | ${row.matched} |`).join('\n')}\n\nSee report.json for inputs, diagnostics, worker shutdown and fingerprints.\n`)
}
