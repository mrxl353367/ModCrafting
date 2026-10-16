/** Public data contracts. No Electron, MCP SDK or Node runtime imports. */
import type { FABRIC_TARGET } from './domain.ts'

export type RuntimePaths = { dataRoot: string; knowledgeRoot: string; assetsRoot: string; reportsRoot: string; logsRoot: string }
export type RuntimeEvents = { onLog?: (scope: string, line: string) => void; onState?: (scope: string, state: Record<string, unknown>) => void }
export type EnvironmentStatus = { ok: boolean; platform: string; node: string; java: { ok: boolean; version?: string; path?: string; error?: string }; gradleWrapper: boolean; target: typeof FABRIC_TARGET; remediation: string[] }
export type FabricProject = { path: string; valid: boolean; modId?: string; minecraftVersion?: string; wrapperPath?: string; errors: string[] }
export type JobStatus = 'running' | 'completed' | 'failed' | 'stopped'
export type JobSnapshot = { id: string; kind: string; status: JobStatus; startedAt: string; finishedAt?: string; output: string[]; pid?: number; result?: Record<string, unknown>; error?: string; code?: string }
export type CoreFailure = { ok: false; error: string; code: string }
export type BridgeResult = { ok: boolean; status: number; data: Record<string, unknown>; error?: string }
export type LocalAssetStatus = { name: string; path: string; status: 'missing' | 'present' | 'invalid'; error?: string }
export type GameInstance = { instanceId: string; projectPath: string; gameDirectory: string; jobId: string }
export type CoreRuntimeState = { contractVersion: 1; jobs: JobSnapshot[]; instances: GameInstance[] }
export type GameRuntimeStatus = GameInstance & { ok: true; job: JobSnapshot | CoreFailure; bridgeReady: boolean; capabilities?: Record<string, unknown> }
export type CoreCapabilities = {
  contractVersion: 1; supportedAssertions: readonly string[]; unsupportedAssertions: readonly string[]
  entityQuery: { radius: 32; limit: 64; tagFilters: false }
  toolchain: { source: 'system'; automaticDownload: false; scaffoldIncludesWrapper: false }
}
export type CoreEnvironmentStatus = EnvironmentStatus & { contractVersion: 1; paths: RuntimePaths; assets: LocalAssetStatus[]; capabilities: CoreCapabilities }
