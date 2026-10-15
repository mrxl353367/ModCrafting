import { z } from 'zod'
import type { GameTestVerdict } from './domain.ts'

export interface AcceptanceEvidence { passed: boolean; unavailable?: boolean }
/** Shared by the existing engines; unavailable evidence is never a product FAIL. */
export function acceptanceVerdict(rows: AcceptanceEvidence[], options: { visualOnly?: boolean; cancelled?: boolean; cleanupFailed?: boolean } = {}): GameTestVerdict {
  if (options.visualOnly || options.cancelled || options.cleanupFailed || !rows.length || rows.some((row) => row.unavailable)) return 'INCONCLUSIVE'
  return rows.every((row) => row.passed === true) ? 'PASS' : 'FAIL'
}

const evidenceSchema = z.object({ assertionType: z.string(), passed: z.boolean(), unavailable: z.boolean(), detail: z.string() }).strict()
const snapshotSchema = z.object({ requestId: z.string().min(1), observedAt: z.number().finite() }).strict()
const freshSnapshots = (rows: Array<{ requestId: string; observedAt: number }>) => rows.length === 2 && rows[0].requestId !== rows[1].requestId && rows[1].observedAt >= rows[0].observedAt
export const acceptanceReportSchema = z.object({
  reportVersion: z.literal(1), producer: z.enum(['core', 'desktop']), execution: z.enum(['fixture', 'live']),
  scenarioId: z.string().nullable(), engineVersion: z.string(), minecraftVersion: z.string(),
  evidenceSource: z.string(), verdict: z.enum(['PASS', 'FAIL', 'INCONCLUSIVE']), legacyVerdict: z.enum(['PASS', 'FAIL', 'INCONCLUSIVE']),
  code: z.string(), reason: z.string(), evidence: z.array(evidenceSchema), snapshots: z.array(snapshotSchema),
  cleanup: z.object({ status: z.enum(['complete', 'failed', 'unverified', 'skipped']), completed: z.number().int().nonnegative().nullable() }).strict()
}).strict().superRefine((report, ctx) => {
  if (report.verdict === 'PASS' && (report.legacyVerdict !== 'PASS' || report.code !== 'OK' || report.cleanup.status !== 'complete' || acceptanceVerdict(report.evidence) !== 'PASS' || !freshSnapshots(report.snapshots))) ctx.addIssue({ code: 'custom', message: 'PASS requires successful evidence, fresh snapshots and verified cleanup' })
})
export type AcceptanceReport = z.infer<typeof acceptanceReportSchema>

export function createAcceptanceReport(input: {
  producer: AcceptanceReport['producer']; execution: AcceptanceReport['execution']; scenarioId: string | null
  engineVersion: string; minecraftVersion: string; evidenceSource: string; verdict: GameTestVerdict
  code: string; reason?: string; evidence: Array<AcceptanceEvidence & { assertion: { type: string }; detail: string; code?: string }>
  cleanup?: { attempted: boolean; completed: number; failed: boolean }; diagnostic?: boolean
  snapshots?: Array<{ requestId: unknown; observedAt: unknown }>
}): AcceptanceReport {
  const evidence = input.evidence.map((row) => ({ assertionType: row.assertion.type, passed: row.passed, unavailable: Boolean(row.unavailable || (row.code && !['OK', 'ASSERTION_FAILED'].includes(row.code))), detail: row.detail }))
  const cleanup = input.cleanup ? { status: input.cleanup.failed ? 'failed' as const : input.cleanup.attempted ? 'complete' as const : 'skipped' as const, completed: input.cleanup.completed } : { status: 'unverified' as const, completed: null }
  const parsedSnapshots = z.array(snapshotSchema).safeParse(input.snapshots || [])
  const snapshots = parsedSnapshots.success ? parsedSnapshots.data : []
  const incompletePass = input.verdict === 'PASS' && (input.diagnostic || cleanup.status !== 'complete' || acceptanceVerdict(evidence) !== 'PASS' || !freshSnapshots(snapshots))
  return acceptanceReportSchema.parse({
    reportVersion: 1, producer: input.producer, execution: input.execution, scenarioId: input.scenarioId,
    engineVersion: input.engineVersion, minecraftVersion: input.minecraftVersion, evidenceSource: input.evidenceSource,
    verdict: incompletePass ? 'INCONCLUSIVE' : input.verdict, legacyVerdict: input.verdict,
    code: incompletePass ? 'EVIDENCE_MISSING' : input.code,
    reason: incompletePass ? 'Legacy PASS lacks verified cleanup/fresh evidence or is diagnostic only' : input.reason || '', evidence, snapshots, cleanup
  })
}
