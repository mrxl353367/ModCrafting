import { parseArgs } from 'node:util'
import { inspectDesktopProfile, migrateDesktopProfile } from '../../packages/modcrafting-core/src/desktop-migration.ts'

const { values } = parseArgs({ options: { 'user-data': { type: 'string' }, 'runtime-root': { type: 'string' }, 'data-root': { type: 'string' }, apply: { type: 'boolean' }, help: { type: 'boolean' } } })
if (values.help) console.log('Usage: migrate-desktop --user-data ABSOLUTE-DESKTOP-PROFILE [--runtime-root ABSOLUTE-RUNTIME] [--apply --data-root NEW-ABSOLUTE-DATA-ROOT]. Default: read-only inventory. Imports project references only; leaves credentials, sessions, worlds and caches in place. Stop Desktop before importing. No downloads, links, overwrites or deletions.')
else {
  if (!values['user-data']) throw Error('--user-data is required; profile locations are never guessed')
  if (values.apply && !values['data-root']) throw Error('--apply requires a new --data-root')
  if (!values.apply && values['data-root']) throw Error('--data-root requires --apply; omit both for a read-only inventory')
  const result = values.apply ? migrateDesktopProfile(values['user-data'], values['data-root']!, values['runtime-root']) : inspectDesktopProfile(values['user-data'], values['runtime-root'])
  console.log(JSON.stringify({ ok: true, mode: values.apply ? 'import' : 'inventory', ...result }, null, 2))
}
