import { createHash } from 'node:crypto'
// Explicit dependency injection for orchestration tests. Never distributed as a real game component.
const bytes = Buffer.from('Fixture Observer bytes; not an executable mod')
export const fixtureObserver = { jarBase64: bytes.toString('base64'), sha256: createHash('sha256').update(bytes).digest('hex'), version: 'fixture', protocol: 2 as const }
