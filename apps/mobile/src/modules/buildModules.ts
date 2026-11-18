/**
 * This build's answer to `moduleVisibility.ts`: read once, from the bundle ID
 * `app.config.ts` gave it (`APP_VARIANT`). An over-the-air update carries the
 * config it was published with, and the publisher sets `APP_VARIANT` per
 * channel, so an update answers the same as the build it lands on.
 *
 * `EXPO_PUBLIC_LIVE_MODULES_ONLY=1` makes a development build answer like the
 * store build, for store screenshots (`apps/mobile/README.md`).
 */
import Constants from 'expo-constants'

import { isModuleShown, showsOnlyLiveModules } from './moduleVisibility'

export const LIVE_MODULES_ONLY = showsOnlyLiveModules(
  Constants.expoConfig?.ios?.bundleIdentifier ??
    Constants.expoConfig?.android?.package,
  // Static dot access: Metro inlines `EXPO_PUBLIC_*` textually.
  process.env.EXPO_PUBLIC_LIVE_MODULES_ONLY,
)

/** Whether this build shows a Module anywhere. */
export function moduleShown(moduleId: string): boolean {
  return isModuleShown(moduleId, LIVE_MODULES_ONLY)
}
