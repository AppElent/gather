import { ENV_CONFIG } from '../env.manifest.ts'

export {
  mergeInfisicalFolders,
  normalizeInfisicalExport,
  readInfisicalConfig,
} from './lib/env/index.mjs'

export const INFISICAL_ENVIRONMENTS = ENV_CONFIG.source.environments
