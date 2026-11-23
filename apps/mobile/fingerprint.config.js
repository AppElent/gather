// Inputs to the runtime fingerprint (`runtimeVersion` policy `fingerprint`)
// beyond Expo's default `balanced` preset.
//
// The Apple targets under `targets/` (widgets, and later the watch app) are
// generated into the iOS project at prebuild by @bacons/apple-targets. Expo
// only hashes their `expo-target.config.js`, so a change to their Swift,
// plists or string catalogs alone kept the same runtime version and could
// reach installed builds as an over-the-air update without the native code.
// Hashing the whole folder makes such a change ask for a new build.
/** @type {import('expo/fingerprint').Config} */
module.exports = {
  extraSources: [{ type: 'dir', filePath: 'targets', reasons: ['appleTargets'] }],
}
