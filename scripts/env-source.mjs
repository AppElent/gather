import * as manifest from '../env.manifest.ts'
import { resolveEnvironmentManifest } from './lib/env/index.mjs'

export {
  mergeInfisicalFolders,
  normalizeInfisicalExport,
  readInfisicalConfig,
} from './lib/env/index.mjs'

/** env.manifest.ts with the shared routing filled in, as `scripts/env.mjs` loads it. */
export const RESOLVED_MANIFEST = resolveEnvironmentManifest({ ...manifest })

export const INFISICAL_ENVIRONMENTS =
  RESOLVED_MANIFEST.ENV_CONFIG.source.environments
