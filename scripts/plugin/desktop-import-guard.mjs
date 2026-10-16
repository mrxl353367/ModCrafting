import { registerHooks } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Reuse the protocol smoke's resolve-hook boundary for standalone Core regressions.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const normalize = (value) => process.platform === 'win32' ? value.toLowerCase() : value
const desktop = normalize(path.join(root, 'src') + path.sep)
const electron = normalize(path.join(root, 'node_modules', 'electron') + path.sep)
function checkUrl(url) {
  if (!url.startsWith('file:')) return
  const file = normalize(fileURLToPath(url))
  if (file.startsWith(desktop) || file.startsWith(electron)) throw new Error('DESKTOP_DEPENDENCY_FORBIDDEN')
}
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'electron' || specifier.startsWith('electron/')) throw new Error('DESKTOP_DEPENDENCY_FORBIDDEN')
  // A stripped standalone checkout has no Desktop files; reject even before resolution.
  checkUrl(specifier)
  const result = next(specifier, context)
  checkUrl(result.url)
  return result
} })
