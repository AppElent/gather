/**
 * One identity per EAS profile, with the phone app's bundle IDs (ADR 0052), so
 * the tvOS app can join the iPhone app's App Store record. Keep the IDs, names
 * and team equal to `apps/mobile/app.config.ts`.
 *
 * `APP_VARIANT` is set per profile in `eas.json`. Unset means a local
 * development build.
 */
import type { ConfigContext, ExpoConfig } from 'expo/config'

const APPLE_TEAM_ID = 'D8AMB5N29A'

const APP_VARIANTS = {
  production: { suffix: '', name: 'Gather', scheme: 'gather' },
  preview: {
    suffix: '.preview',
    name: 'Gather Preview',
    scheme: 'gather-preview',
  },
  development: { suffix: '.dev', name: 'Gather Dev', scheme: 'gather-dev' },
} as const

type AppVariant = keyof typeof APP_VARIANTS

function appVariant(value = process.env.APP_VARIANT): AppVariant {
  if (!value) return 'development'
  if (Object.hasOwn(APP_VARIANTS, value)) return value as AppVariant
  throw new Error(`Unknown APP_VARIANT "${value}"`)
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const { suffix, name, scheme } = APP_VARIANTS[appVariant()]
  return {
    ...config,
    name,
    // ExpoConfig requires it; `config` types every field as optional.
    slug: 'gather',
    scheme,
    ios: {
      ...config.ios,
      bundleIdentifier: `com.appelent.gather${suffix}`,
      appleTeamId: APPLE_TEAM_ID,
    },
  }
}
