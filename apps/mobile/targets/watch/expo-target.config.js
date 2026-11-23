/**
 * SPIKE (APP-652, do not merge): the watchOS app, a companion of the iOS app.
 *
 * Variant-aware like `targets/widgets/` (ADR 0045): the bundle ID is the app's
 * plus `.watchkitapp` (`com.appelent.gather.dev.watchkitapp`, …), and
 * `@bacons/apple-targets` sets `WKCompanionAppBundleIdentifier` to the
 * variant's app bundle ID, so each variant's watch app pairs only with its own
 * phone app.
 *
 * No `entitlements`: the watch keeps its device key in its own Keychain
 * (default access group = its own App ID) and joins no App Group.
 */

/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'watch',
  name: 'watch',
  displayName: config.name,
  bundleIdentifier: '.watchkitapp',
  deploymentTarget: '11.0',
  frameworks: ['SwiftUI', 'WatchConnectivity', 'Security'],
})
