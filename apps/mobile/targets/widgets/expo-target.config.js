/**
 * The widget extension (APP-207): today one iOS 18 control, which opens the
 * quick-actions sheet from Control Center, the Lock Screen or the Action
 * Button. `@bacons/apple-targets` links this folder into the Xcode project at
 * prebuild; nothing here is generated.
 *
 * The config is a function of the resolved app config, so the extension takes
 * the variant from `app.config.ts` (ADR 0045): its bundle ID is the app's plus
 * `.widgets` and its name is the app's ("Gather", "Gather Preview",
 * "Gather Dev"), which the control shows as its own.
 *
 * No `entitlements`: the control only opens the app, so the extension joins no
 * App Group and needs nothing beyond a plain provisioning profile.
 */

/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'widgets',
  displayName: config.name,
  bundleIdentifier: '.widgets',
  deploymentTarget: '18.0',
  frameworks: ['SwiftUI', 'WidgetKit', 'AppIntents'],
})
