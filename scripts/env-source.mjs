import { ENV_CONFIG } from '../env.manifest.ts'

export {
  mergeInfisicalFolders,
  normalizeInfisicalExport,
  readInfisicalConfig,
} from '@appelent/dev/env'

export const INFISICAL_ENVIRONMENTS = ENV_CONFIG.source.environments
