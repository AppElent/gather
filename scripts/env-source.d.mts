export const INFISICAL_ENVIRONMENTS: Readonly<{
  local: 'dev'
  preview: 'staging'
  stg: 'staging'
  production: 'prod'
}>

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
