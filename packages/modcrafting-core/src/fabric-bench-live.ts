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
export async function settleBenchJob(runtime: FabricRuntime, jobId: string, sessionId: string, timeoutMs: number): Promise<JobSnapshot> {
  const deadline = Date.now() + timeoutMs
  do {
    const job = runtime.jobStatus(jobId, sessionId)
    if (!('status' in job)) throw new CoreError(job.code, job.error)
    if (job.result || job.error) return job
    await benchWait(50)
  } while (Date.now() < deadline)
  throw new CoreError('STOP_UNCONFIRMED', `Worker ${jobId} did not settle within ${timeoutMs}ms`)
}
export async function waitBenchJob(runtime: FabricRuntime, jobId: string, sessionId: string, timeoutMs: number, signal?: AbortSignal): Promise<JobSnapshot> {
  const deadline = Date.now() + timeoutMs
  do {
    if (signal?.aborted || Date.now() >= deadline) {
      runtime.stopJob(jobId, sessionId)
      // Core tests execute their finally cleanup before settling; never discard that report.
      await settleBenchJob(runtime, jobId, sessionId, 30000)
      throw new CoreError(signal?.aborted ? 'CANCELLED' : 'TIMEOUT', `Job ${jobId} interrupted`)
    }
    const job = runtime.jobStatus(jobId, sessionId)
    if (!('status' in job)) throw new CoreError(job.code, job.error)
    if (job.result || job.error) return job
    await benchWait(50)
  } while (true)
}
export async function waitBenchReady(runtime: FabricRuntime, instanceId: string, sessionId: string, timeoutMs = 300000, signal?: AbortSignal) {
  const deadline = Date.now() + timeoutMs
  do {
    if (signal?.aborted) throw new CoreError('CANCELLED', 'Bench cancelled while waiting for the test world.')
    const status = await runtime.runtimeStatus(instanceId, sessionId)
    if (!('status' in status.job) || status.job.status !== 'running') throw new CoreError('CLIENT_FAILED', status.job.error || 'Minecraft client stopped before the test world was ready.')
    if (status.canRunTests) return status
    if (status.preparation.phase === 'failed') throw new CoreError('GAME_PREPARATION_FAILED', status.preparation.blockedReason || status.message || 'Game preparation failed.')
    if (Date.now() >= deadline) throw new CoreError('GAME_NOT_READY', `${status.preparation.phase}: ${status.preparation.blockedReason || 'test world preparation timed out'}`)
    await benchWait(250)
  } while (true)
}

export async function requireBenchWorld(runtime: FabricRuntime, instanceId: string, sessionId: string) {
  const ready = await runtime.runtimeStatus(instanceId, sessionId)
  if (!ready.canRunTests) throw new CoreError('GAME_NOT_READY', `${ready.preparation.phase}: ${ready.preparation.blockedReason || ready.message || 'test world is not ready'}`)
  const snapshot = await runtime.snapshot(instanceId, undefined, sessionId)
  if (!snapshot.ok || snapshot.data.worldName !== GAME_TEST_WORLD) throw new CoreError('WORLD_UNAVAILABLE', `Bench requires ${GAME_TEST_WORLD}; observed ${snapshot.data.worldName || 'no world'}`)
  return snapshot
}
export async function benchCommand(runtime: FabricRuntime, instanceId: string, sessionId: string, command: string) {
  await requireBenchWorld(runtime, instanceId, sessionId)
  const result = await runtime.command(command, instanceId, sessionId)
  if (!result.ok || result.data.executed !== true) throw new CoreError('ACTION_FAILED', `Bench command failed: ${command}`)
  return result
}

/** Uses the same live Core jobs/reports as MCP; owns neither a client nor a model. */
export async function runLiveFabricBench(runtime: FabricRuntime, raw: unknown, instanceId: string, options: {
  sessionId: string; caseTimeoutMs?: number; signal?: AbortSignal; onCase?: (row: FabricBenchCaseResult & { job?: JobSnapshot }) => Promise<void>
}) {
  if (!options.sessionId) throw new CoreError('SESSION_REQUIRED', 'Live Bench must be bound to an explicit task session.')
  const suite = fabricBenchLiveSchema.parse(raw), cases: Array<FabricBenchCaseResult & { job?: JobSnapshot }> = []
  let interrupted = false
  await waitBenchReady(runtime, instanceId, options.sessionId, 300000, options.signal)
  for (const row of suite.cases) {
    let jobId: string | undefined, error: unknown
    try {
      if (options.signal?.aborted) throw new CoreError('CANCELLED', 'Bench cancelled')
      for (const command of row.prepare) await benchCommand(runtime, instanceId, options.sessionId, command)
      await requireBenchWorld(runtime, instanceId, options.sessionId)
      jobId = runtime.startTest(row.spec, instanceId, options.sessionId).jobId
      const job = await waitBenchJob(runtime, jobId, options.sessionId, options.caseTimeoutMs ?? 30000, options.signal)
      if (!job.result?.acceptance) throw new CoreError(job.code || 'EVIDENCE_MISSING', job.error || 'Core report missing')
    } catch (failure) { error = failure }
    const job = jobId ? runtime.jobStatus(jobId, options.sessionId) : undefined
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
