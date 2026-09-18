import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const INFISICAL_ENVIRONMENTS = {
  local: 'dev',
  preview: 'staging',
  stg: 'staging',
  production: 'prod',
}

export function readInfisicalConfig(root) {
  const path = join(root, '.infisical.json')
  if (!existsSync(path)) {
    throw new Error(
      'Missing .infisical.json. Log into the EU tenant, then run `infisical init` in the repository root.',
    )
  }
  let config
  try {
    config = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    throw new Error(`Invalid .infisical.json: ${error.message}`)
  }
  if (!config.workspaceId && !config.projectId) {
    throw new Error(
      'Invalid .infisical.json: expected a workspaceId or projectId from `infisical init`.',
    )
  }
  return config
}

export function normalizeInfisicalExport(parsed) {
  if (Array.isArray(parsed)) {
    return Object.fromEntries(
      parsed.map((item) => [
        item.secretKey ?? item.key,
        item.secretValue ?? item.value,
      ]),
    )
  }
  if (parsed && typeof parsed === 'object') {
    return Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => [
        key,
        value && typeof value === 'object' && 'value' in value
          ? value.value
          : value,
      ]),
    )
  }
  throw new Error('Infisical export returned an unsupported JSON shape.')
}

export function mergeInfisicalFolders(rootValues, gatherValues) {
  const overrides = Object.keys(gatherValues)
    .filter((key) => key in rootValues)
    .sort()
  return { values: { ...rootValues, ...gatherValues }, overrides }
}
