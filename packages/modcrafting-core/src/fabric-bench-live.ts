import { z } from 'zod'
import { FABRIC_TARGET, GAME_TEST_WORLD, validateGameTestSpec } from './domain.ts'
import { acceptanceReportSchema, createAcceptanceReport } from './acceptance.ts'
import { summarizeFabricBench, type FabricBenchCaseResult } from './fabric-bench.ts'
import { CoreError, type FabricRuntime } from './runtime.ts'
import type { JobSnapshot } from './contracts.ts'

const specSchema = z.unknown().transform((raw, ctx) => {
  const parsed = validateGameTestSpec(raw)
  if ('error' in parsed) { ctx.addIssue({ code: 'custom', message: parsed.error }); return z.NEVER }
  return parsed.spec
})
export const fabricBenchLiveSchema = z.object({
  suiteVersion: z.literal(1), id: z.string().min(1), execution: z.literal('live'),
  cases: z.array(z.object({
    id: z.string().regex(/^[a-z0-9_-]+$/), prepare: z.array(z.string().trim().min(1)), spec: specSchema,
    expected: z.object({ verdict: z.enum(['PASS', 'FAIL', 'INCONCLUSIVE']), code: z.string().min(1) }).strict()
  }).strict()).min(1)
}).strict().refine((suite) => new Set(suite.cases.map((row) => row.id)).size === suite.cases.length && new Set(suite.cases.map((row) => row.spec.id)).size === suite.cases.length, 'Duplicate case or scenario IDs')

export const benchWait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
/** Stopped is an acknowledgement; result/error confirms the owned worker settled. */
export async function settleBenchJob(runtime: FabricRuntime, jobId: string, timeoutMs: number): Promise<JobSnapshot> {
  const deadline = Date.now() + timeoutMs
  do {
    const job = runtime.jobStatus(jobId)
    if (!('status' in job)) throw new CoreError(job.code, job.error)
    if (job.result || job.error) return job
    await benchWait(50)
  } while (Date.now() < deadline)
  throw new CoreError('STOP_UNCONFIRMED', `Worker ${jobId} did not settle within ${timeoutMs}ms`)
}
export async function waitBenchJob(runtime: FabricRuntime, jobId: string, timeoutMs: number, signal?: AbortSignal): Promise<JobSnapshot> {
  const deadline = Date.now() + timeoutMs
  do {
    if (signal?.aborted || Date.now() >= deadline) {
      runtime.stopJob(jobId)
      // Core tests execute their finally cleanup before settling; never discard that report.
      await settleBenchJob(runtime, jobId, 30000)
      throw new CoreError(signal?.aborted ? 'CANCELLED' : 'TIMEOUT', `Job ${jobId} interrupted`)
    }
    const job = runtime.jobStatus(jobId)
    if (!('status' in job)) throw new CoreError(job.code, job.error)
    if (job.result || job.error) return job
    await benchWait(50)
  } while (true)
}
export async function requireBenchWorld(runtime: FabricRuntime, instanceId: string) {
  const snapshot = await runtime.snapshot(instanceId)
  if (!snapshot.ok || snapshot.data.worldName !== GAME_TEST_WORLD) throw new CoreError('WORLD_UNAVAILABLE', `Bench requires ${GAME_TEST_WORLD}; observed ${snapshot.data.worldName || 'no world'}`)
  return snapshot
}
export async function benchCommand(runtime: FabricRuntime, instanceId: string, command: string) {
  await requireBenchWorld(runtime, instanceId)
  const result = await runtime.command(command, instanceId)
  if (!result.ok || result.data.executed !== true) throw new CoreError('ACTION_FAILED', `Bench command failed: ${command}`)
  return result
}

/** Uses the same live Core jobs/reports as MCP; owns neither a client nor a model. */
export async function runLiveFabricBench(runtime: FabricRuntime, raw: unknown, instanceId: string, options: {
  caseTimeoutMs?: number; signal?: AbortSignal; onCase?: (row: FabricBenchCaseResult & { job?: JobSnapshot }) => Promise<void>
} = {}) {
  const suite = fabricBenchLiveSchema.parse(raw), cases: Array<FabricBenchCaseResult & { job?: JobSnapshot }> = []
  let interrupted = false
  for (const row of suite.cases) {
    let jobId: string | undefined, error: unknown
    try {
      if (options.signal?.aborted) throw new CoreError('CANCELLED', 'Bench cancelled')
      for (const command of row.prepare) await benchCommand(runtime, instanceId, command)
      await requireBenchWorld(runtime, instanceId)
      jobId = runtime.startTest(row.spec, instanceId).jobId
      const job = await waitBenchJob(runtime, jobId, options.caseTimeoutMs ?? 30000, options.signal)
      if (!job.result?.acceptance) throw new CoreError(job.code || 'EVIDENCE_MISSING', job.error || 'Core report missing')
    } catch (failure) { error = failure }
    const job = jobId ? runtime.jobStatus(jobId) : undefined
    const settled = job && 'status' in job ? job : undefined
    const coreReport = settled?.result?.acceptance ? acceptanceReportSchema.parse(settled.result.acceptance) : undefined
    const errorCode = error instanceof CoreError ? error.code : 'BENCH_FAILED'
    const acceptance = error && coreReport ? acceptanceReportSchema.parse({ ...coreReport, verdict: 'INCONCLUSIVE', code: coreReport.cleanup.status === 'failed' ? 'CLEANUP_FAILED' : errorCode, reason: String(error) }) : error ? createAcceptanceReport({
      producer: 'core', execution: 'live', scenarioId: row.spec.id, engineVersion: runtime.version,
      minecraftVersion: FABRIC_TARGET.minecraft, evidenceSource: 'observer-v2', verdict: 'INCONCLUSIVE',
      code: errorCode, reason: String(error), evidence: []
    }) : coreReport!
    const result = { id: row.id, expected: row.expected, matched: acceptance.verdict === row.expected.verdict && acceptance.code === row.expected.code, acceptance, job: settled }
    cases.push(result); await options.onCase?.(result)
    // Unexpected orchestration/environment failures cannot contaminate later cases.
    if (error) { interrupted = true; break }
  }
  const report = summarizeFabricBench(suite.id, 'live', cases, suite.cases.length)
  return { ...report, ok: report.ok && !interrupted }
}
