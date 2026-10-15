import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { runFabricBench, fabricBenchSchema } from '../../packages/modcrafting-core/src/fabric-bench.ts'
import { acceptanceVerdict, createAcceptanceReport, acceptanceReportSchema } from '../../packages/modcrafting-core/src/acceptance.ts'

const suite = JSON.parse(await readFile(new URL('../bench/fabric-bench-mvp.json', import.meta.url), 'utf8'))
test('Fabric-Bench exercises Core and matches the declared verdict/code matrix', async () => {
  const report = await runFabricBench(suite)
  assert.equal(report.ok, true)
  assert.equal(report.counts.total, 21)
  assert.deepEqual(report.counts.verdicts, { PASS: 5, FAIL: 5, INCONCLUSIVE: 11 })
  for (const row of report.cases) {
    assert.equal(row.matched, true, row.id)
    assert.equal(row.acceptance.execution, 'fixture')
    assert.equal(row.acceptance.producer, 'core')
    acceptanceReportSchema.parse(row.acceptance)
  }
  assert.equal(report.cases.find((row) => row.id === 'action-error')?.cleanupCalls, 1)
  assert.equal(report.cases.find((row) => row.id === 'wrong-world')?.cleanupCalls, 0)
  assert.equal(report.cases.find((row) => row.id === 'cleanup-error')?.acceptance.cleanup.status, 'failed')
})
test('Bench mismatch is reported and duplicate/invalid suites are rejected', async () => {
  const changed = structuredClone(suite); changed.cases[0].expected.verdict = 'FAIL'
  const report = await runFabricBench(changed)
  assert.equal(report.ok, false)
  assert.equal(report.counts.mismatched, 1)
  assert.throws(() => fabricBenchSchema.parse({ ...suite, cases: [suite.cases[0], suite.cases[0]] }))
  assert.throws(() => fabricBenchSchema.parse({ ...suite, cases: [] }))
})
test('Shared verdict is conservative for empty/unavailable/cancelled/cleanup failure evidence', () => {
  assert.equal(acceptanceVerdict([]), 'INCONCLUSIVE')
  assert.equal(acceptanceVerdict([{ passed: false, unavailable: true }]), 'INCONCLUSIVE')
  for (const option of [{ cancelled: true }, { cleanupFailed: true }, { visualOnly: true }]) assert.equal(acceptanceVerdict([{ passed: true }], option), 'INCONCLUSIVE')
  assert.equal(acceptanceVerdict([{ passed: false }]), 'FAIL')
  assert.equal(acceptanceVerdict([{ passed: true }]), 'PASS')
})
test('Acceptance summary preserves legacy result without inventing cleanup or diagnostic PASS', () => {
  const input = { producer: 'core' as const, execution: 'fixture' as const, scenarioId: 'core-fixture', engineVersion: 'fixture', minecraftVersion: '1.21.4', evidenceSource: 'fixture', verdict: 'PASS' as const, code: 'OK', evidence: [{ assertion: { type: 'inventory_contains' }, passed: true, detail: 'fixture' }] }
  const report = createAcceptanceReport(input)
  assert.equal(report.verdict, 'INCONCLUSIVE')
  assert.equal(report.legacyVerdict, 'PASS')
  assert.equal(report.cleanup.status, 'unverified')
  const verified = createAcceptanceReport({ ...input, cleanup: { attempted: true, completed: 1, failed: false }, snapshots: [{ requestId: 'before', observedAt: 1 }, { requestId: 'after', observedAt: 2 }] })
  assert.equal(verified.verdict, 'PASS')
  assert.equal(createAcceptanceReport({ ...input, cleanup: { attempted: true, completed: 1, failed: false }, diagnostic: true }).verdict, 'INCONCLUSIVE')
  assert.throws(() => acceptanceReportSchema.parse({ ...report, verdict: 'PASS' }))
  assert.throws(() => acceptanceReportSchema.parse({ ...verified, snapshots: [{ requestId: 'same', observedAt: 1 }, { requestId: 'same', observedAt: 2 }] }))
})
