import type { BrowserAction } from '../../../plugins/modcrafting-fabric/src/browser-server.ts'
import type { CoreRuntimeState } from '../../modcrafting-core/src/contracts.ts'

const fragment = new URLSearchParams(location.hash.slice(1)).get('token')
if (fragment) { sessionStorage.setItem('modcrafting-view-token', fragment); history.replaceState(null, '', location.pathname) }
const token = sessionStorage.getItem('modcrafting-view-token') || ''
export async function request<T>(route: string, action?: BrowserAction): Promise<T> {
  const response = await fetch(route, { method: action ? 'POST' : 'GET', headers: { authorization: `Bearer ${token}`, ...(action ? { 'content-type': 'application/json' } : {}) }, body: action ? JSON.stringify(action) : undefined })
  const value = await response.json()
  if (!response.ok || value.ok === false) throw Error(`${value.code || value.data?.code || 'OPERATION_FAILED'}: ${value.error || value.data?.error || JSON.stringify(value)}`)
  return value
}
export const action = <T,>(value: BrowserAction) => request<T>('/api/action', value)
export const state = () => request<CoreRuntimeState>('/api/state')
