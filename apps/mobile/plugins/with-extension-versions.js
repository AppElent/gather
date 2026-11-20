/**
 * Keeps every app extension's `CFBundleVersion` and `CFBundleShortVersionString`
 * equal to the app's (APP-464).
 *
 * Why it is needed: with `appVersionSource: remote` and `autoIncrement`, EAS
 * Build writes the build number into the `INFOPLIST_FILE` of every target it
 * builds, after prebuild. The extension targets that `expo-share-intent` and
 * `@bacons/apple-targets` add set `GENERATE_INFOPLIST_FILE = YES` with a fixed
 * `CURRENT_PROJECT_VERSION = 1`, and Xcode's generated keys win over the value
 * in the source plist. The app ships build N, its extensions build 1, and App
 * Store Connect warns (ITMS-90473). Nothing at prebuild knows the number, so
 * this plugin adds a last Run Script phase to each extension that copies the
 * two keys from the app's source `Info.plist` (the one EAS updated) into the
 * extension's built `Info.plist`, before code signing.
 *
 * A value that is still a build-setting reference (`$(CURRENT_PROJECT_VERSION)`,
 * as in a local run that EAS did not touch; any value with a `$`) is skipped, so the extension keeps
 * its own generated value there.
 *
 * Register it after `expo-share-intent` and `@bacons/apple-targets` in
 * `app.json`. It runs as a finalized mod, after both have written their
 * targets, so the order only keeps the config readable.
 */
const fs = require('node:fs')
const { IOSConfig, withFinalizedMod } = require('expo/config-plugins')

const PHASE_NAME = '[Gather] Sync extension version with app'
const APP_EXTENSION = 'com.apple.product-type.app-extension'
const APPLICATION = 'com.apple.product-type.application'

/** The keys EAS writes and App Store Connect compares between app and extension. */
const KEYS = ['CFBundleVersion', 'CFBundleShortVersionString']

const unquote = (value) =>
  typeof value === 'string' && value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value

/**
 * The script one extension target runs. `appPlist` is the app's source plist
 * relative to the Xcode project's `SRCROOT` (the `ios` folder).
 */
function versionSyncScript(appPlist) {
  return [
    'set -e',
    `APP_PLIST="\${SRCROOT}/${appPlist}"`,
    'EXTENSION_PLIST="${TARGET_BUILD_DIR}/${INFOPLIST_PATH}"',
    'PLIST_BUDDY=/usr/libexec/PlistBuddy',
    `for KEY in ${KEYS.join(' ')}; do`,
    '  VALUE=$("$PLIST_BUDDY" -c "Print :$KEY" "$APP_PLIST" 2>/dev/null || true)',
    '  case "$VALUE" in',
    '    ""|*[$]*) continue ;;',
    '  esac',
    '  if ! "$PLIST_BUDDY" -c "Set :$KEY $VALUE" "$EXTENSION_PLIST" 2>/dev/null; then',
    '    "$PLIST_BUDDY" -c "Add :$KEY string $VALUE" "$EXTENSION_PLIST"',
    '  fi',
    '  echo "$PRODUCT_NAME: $KEY = $VALUE"',
    'done',
    '',
  ].join('\n')
}

/** Every native target of one product type, as `[uuid, target]`. */
function targetsOfType(project, productType) {
  const section = project.pbxNativeTargetSection()
  return Object.entries(section).filter(
    ([key, target]) => !key.endsWith('_comment') && unquote(target.productType) === productType,
  )
}

/** The `INFOPLIST_FILE` of a target's Release configuration, relative to `SRCROOT`. */
function infoPlistOf(project, target) {
  const configurations = IOSConfig.XcodeUtils.getBuildConfigurationsForListId(project, target.buildConfigurationList)
  const release = configurations.find(([, configuration]) => configuration.name === 'Release') ?? configurations[0]
  const file = release?.[1]?.buildSettings?.INFOPLIST_FILE
  return file ? unquote(file) : undefined
}

/**
 * Adds the version-sync Run Script phase to every app extension of an Xcode
 * project, once. Returns the names of the targets it changed.
 */
function addVersionSyncPhases(project) {
  const [application] = targetsOfType(project, APPLICATION)
  const appPlist = application && infoPlistOf(project, application[1])
  if (!appPlist) throw new Error('with-extension-versions: the app target has no INFOPLIST_FILE')

  const changed = []
  for (const [uuid, target] of targetsOfType(project, APP_EXTENSION)) {
    const present = (target.buildPhases ?? []).some(({ comment }) => comment === PHASE_NAME)
    if (present) continue
    const { buildPhase } = project.addBuildPhase([], 'PBXShellScriptBuildPhase', PHASE_NAME, uuid, {
      shellPath: '/bin/sh',
      shellScript: versionSyncScript(appPlist).replace(/\n/g, '\\n'),
      // Declared so the phase also works with user-script sandboxing on: it reads the app's
      // source plist and rewrites the extension's built plist, and nothing else.
      inputPaths: [`"$(SRCROOT)/${appPlist}"`],
      outputPaths: ['"$(TARGET_BUILD_DIR)/$(INFOPLIST_PATH)"'],
    })
    // Run on every build: Xcode rewrites the built plist whenever its inputs change, which would
    // otherwise look like an up-to-date output of this phase.
    buildPhase.alwaysOutOfDate = 1
    changed.push(unquote(target.name))
  }
  return changed
}

/** @type {import('expo/config-plugins').ConfigPlugin} */
const withExtensionVersions = (config) =>
  withFinalizedMod(config, [
    'ios',
    async (modConfig) => {
      const project = IOSConfig.XcodeUtils.getPbxproj(modConfig.modRequest.projectRoot)
      addVersionSyncPhases(project)
      fs.writeFileSync(project.filepath, project.writeSync())
      return modConfig
    },
  ])

module.exports = withExtensionVersions
module.exports.addVersionSyncPhases = addVersionSyncPhases
module.exports.versionSyncScript = versionSyncScript
module.exports.PHASE_NAME = PHASE_NAME
