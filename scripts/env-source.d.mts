import type {
  EnvironmentManifest,
  EnvironmentPlacement,
} from './lib/env/types.ts'

export const RESOLVED_MANIFEST: EnvironmentManifest & {
  placementsFor(
    environment: string,
    context?: { prNumber?: string },
  ): EnvironmentPlacement[]
}

export const INFISICAL_ENVIRONMENTS: Readonly<Record<string, string>>

export type InfisicalConfig = {
  workspaceId?: string
  projectId?: string
  defaultEnvironment?: string
  gitBranchToEnvironmentMapping?: unknown
  [key: string]: unknown
}

export function readInfisicalConfig(root: string): InfisicalConfig
export function normalizeInfisicalExport(
  parsed: unknown,
): Record<string, string>
export function mergeInfisicalFolders(
  rootValues: Record<string, string>,
  gatherValues: Record<string, string>,
): { values: Record<string, string>; overrides: string[] }
