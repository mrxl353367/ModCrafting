import { z } from 'zod'
import { GAME_TEST_WORLD } from './domain.ts'
import { executeGameTest } from './game-test.ts'
import { acceptanceReportSchema, type AcceptanceReport } from './acceptance.ts'

export interface FabricBenchCaseResult {
  id: string
  expected: { verdict: AcceptanceReport['verdict']; code: string }
  matched: boolean
  acceptance: AcceptanceReport
}
/** Expected failures are matches, but remain FAIL/INCONCLUSIVE in verdict totals. */
export function summarizeFabricBench<T extends FabricBenchCaseResult>(suiteId: string, execution: 'fixture' | 'live', cases: T[], planned = cases.length) {
  return { reportVersion: 1 as const, suiteId, execution, ok: cases.length === planned && cases.every((row) => row.matched), counts: { total: planned, executed: cases.length, matched: cases.filter((row) => row.matched).length, mismatched: cases.filter((row) => !row.matched).length, notRun: planned - cases.length, verdicts: { PASS: cases.filter((row) => row.acceptance.verdict === 'PASS').length, FAIL: cases.filter((row) => row.acceptance.verdict === 'FAIL').length, INCONCLUSIVE: cases.filter((row) => row.acceptance.verdict === 'INCONCLUSIVE').length } }, cases }
}

const caseSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]+$/), assertion: z.record(z.string(), z.json()),
  before: z.record(z.string(), z.json()).optional(), after: z.record(z.string(), z.json()).optional(),
  mode: z.enum(['normal', 'missing_snapshot', 'same_snapshot', 'action_failure', 'cleanup_failure', 'cancelled', 'invalid_spec', 'wrong_world']).default('normal'),
  expected: z.object({ verdict: z.enum(['PASS', 'FAIL', 'INCONCLUSIVE']), code: z.string().min(1) }).strict()
}).strict()
export const fabricBenchSchema = z.object({ suiteVersion: z.literal(1), id: z.string().min(1), cases: z.array(caseSchema).min(1) }).strict().refine((suite) => new Set(suite.cases.map((row) => row.id)).size === suite.cases.length, 'Duplicate benchmark case IDs')

/** Offline fixtures exercise the same Core execution path as MCP, never launch a game. */
export async function runFabricBench(raw: unknown) {
  const suite = fabricBenchSchema.parse(raw)
  const cases = []
  for (const row of suite.cases) {
    let snapshots = 0, cleanupCalls = 0
    const spec = { version: 2, id: row.id, featureType: 'player_interaction', subject: {}, setup: [], actions: [{ type: 'wait', ms: 0 }], assertions: row.mode === 'invalid_spec' ? [] : [row.assertion], cleanup: [{ type: 'command', command: 'fixture-cleanup' }] }
    const result = await executeGameTest(spec, {
      snapshot: async () => {
        snapshots++
        const snapshot = { ok: true, worldName: row.mode === 'wrong_world' ? 'Ordinary World' : GAME_TEST_WORLD, requestId: row.mode === 'same_snapshot' ? 'stale' : `${row.id}_${snapshots}`, observedAt: 100 + snapshots, inventory: { ok: true, hotbar: [], main: [{ id: 'minecraft:stone', count: 2 }], armor: [], offhand: [] }, blocks: [{ x: 1, y: 100, z: 2, blockId: 'minecraft:stone' }], entities: [{ type: 'minecraft:pig', tags: ['fixture'] }], player: { health: 20 }, ...(snapshots < 3 ? row.before : row.after) }
        return { ok: row.mode !== 'missing_snapshot', data: snapshot }
      },
      action: async (action) => {
        const cleanup = action.type === 'command'
        if (cleanup) cleanupCalls++
        if ((cleanup && row.mode === 'cleanup_failure') || (!cleanup && row.mode === 'action_failure')) throw new Error('Fixture action failure')
        return { ok: true, data: {} }
      },
      cancelled: () => row.mode === 'cancelled'
    }, 'fabric-bench-mvp-v1', 'fixture')
    const acceptance = acceptanceReportSchema.parse(result.acceptance)
    cases.push({ id: row.id, expected: row.expected, matched: acceptance.verdict === row.expected.verdict && acceptance.code === row.expected.code, cleanupCalls, acceptance })
  }
  return summarizeFabricBench(suite.id, 'fixture', cases)
}
