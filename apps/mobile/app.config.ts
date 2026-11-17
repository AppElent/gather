/**
 * One identity per EAS profile, so production, preview and development builds
 * install side by side (the mobile-distribution standard, ADR 0045). `app.json`
 * holds everything shared; this file only swaps the per-variant name, scheme,
 * bundle ID, package, share-extension app group and badged icon. The widget
 * extension (`targets/widgets/`) takes its bundle ID and name from the result.
 *
 * `APP_VARIANT` is set per profile in `eas.json`, and per channel by the
 * update publisher. Unset means a local development build, so a local run never
 * replaces the Preview or store install.
 */
import type { ConfigContext, ExpoConfig } from 'expo/config'

/** Every build this app has; also its EAS Update channel. */
const APP_VARIANTS = {
  production: { suffix: '', name: 'Gather', scheme: 'gather', icon: '' },
  preview: { suffix: '.preview', name: 'Gather Preview', scheme: 'gather-preview', icon: '-preview' },
  development: { suffix: '.dev', name: 'Gather Dev', scheme: 'gather-dev', icon: '-dev' },
} as const

export type AppVariant = keyof typeof APP_VARIANTS

function appVariant(value = process.env.APP_VARIANT): AppVariant {
  if (!value) return 'development'
  if (value in APP_VARIANTS) return value as AppVariant
  throw new Error(`Unknown APP_VARIANT "${value}"`)
}

type PluginEntry = NonNullable<ExpoConfig['plugins']>[number]

/**
 * The share extension's app group follows the bundle ID, so each variant's
 * extension hands a share only to its own app.
 */
function withVariantAppGroup(plugins: PluginEntry[] | undefined, suffix: string): PluginEntry[] | undefined {
  return plugins?.map((plugin) => {
    if (!Array.isArray(plugin) || plugin[0] !== 'expo-share-intent') return plugin
    const [name, options] = plugin
    return [name, { ...options, iosAppGroupIdentifier: `group.com.appelent.gather${suffix}` }]
  })
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const { suffix, name, scheme, icon } = APP_VARIANTS[appVariant()]
  const id = `com.appelent.gather${suffix}`
  return {
    ...config,
    name,
    // ExpoConfig requires it; `config` types every field as optional.
    slug: 'gather',
    scheme,
    icon: `./assets/images/icon${icon}.png`,
    ios: { ...config.ios, bundleIdentifier: id },
    android: {
      ...config.android,
      package: id,
      adaptiveIcon: {
        ...config.android?.adaptiveIcon,
        foregroundImage: `./assets/images/android-icon-foreground${icon}.png`,
      },
    },
    plugins: withVariantAppGroup(config.plugins, suffix),
  }
}
