import assert from 'node:assert/strict'
import test from 'node:test'
import { assertionFromSnapshot, verdictFor, cleanupDesktopTest } from '../../src/renderer/src/harness/game-test-runner.ts'

test('Desktop compatibility verdict remains conservative without a Core dependency', () => {
  for (const [rows, expected] of [
    [[], 'INCONCLUSIVE'], [[{ passed: true }], 'PASS'], [[{ passed: false }], 'FAIL'], [[{ passed: false, unavailable: true }], 'INCONCLUSIVE']
  ] as const) {
    assert.equal(verdictFor(rows as unknown as Parameters<typeof verdictFor>[0], false).verdict, expected)
  }
})

test('Desktop cleanup records failures, continues safe actions and stops after a world switch', async () => {
  const actions = [{ type: 'command' as const, command: 'fixture-1' }, { type: 'command' as const, command: 'fixture-2' }]
  let calls = 0
  const validWorld = async () => ({ ok: true, data: { worldName: 'ModCrafting Test World' } })
  const failed = await cleanupDesktopTest(actions, async () => ({ ok: ++calls !== 1 }), validWorld)
  assert.deepEqual({ completed: failed.completed, failed: failed.failed, calls }, { completed: 1, failed: true, calls: 2 })
  calls = 0; let observations = 0
  const switched = await cleanupDesktopTest(actions, async () => { calls++; return { ok: true } }, async () => ({ ok: true, data: { worldName: ++observations === 1 ? 'ModCrafting Test World' : 'Ordinary World' } }))
  assert.equal(switched.failed, true); assert.equal(calls, 1)
  const thrown = await cleanupDesktopTest(actions, async () => { throw Error('fixture') }, validWorld)
  assert.equal(thrown.failed, true)
  const unavailable = await cleanupDesktopTest(actions, async () => { throw Error('must not run') }, async () => { throw Error('bridge unavailable') })
  assert.equal(unavailable.completed, 0); assert.equal(unavailable.failed, true)
})

test('Desktop entity tags remain unavailable while observed entity types still pass', () => {
  const data = { entities: [{ type: 'minecraft:pig', tags: ['fixture'] }] }
  const row = assertionFromSnapshot({ type: 'entity_exists', entityType: 'minecraft:pig', tag: 'fixture' }, data)
  assert.equal(row.unavailable, true)
  assert.equal(verdictFor([row], false).verdict, 'INCONCLUSIVE')
  assert.equal(assertionFromSnapshot({ type: 'entity_exists', entityType: 'minecraft:pig' }, data).passed, true)
})
