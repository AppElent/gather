/**
 * The config plugin that keeps app-extension versions equal to the app's
 * (APP-464): it adds one Run Script phase to each app extension of the Xcode
 * project, and that script copies the version keys from the app's source
 * plist into the extension's built plist.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

const mobile = path.resolve(__dirname, '../apps/mobile')
const mobileRequire = createRequire(path.join(mobile, 'package.json'))
const pluginRequire = createRequire(mobileRequire.resolve('@expo/config-plugins'))
const xcode = pluginRequire('xcode')
const { addVersionSyncPhases, versionSyncScript, PHASE_NAME } = mobileRequire('./plugins/with-extension-versions.js')

/** An app and two extensions, shaped like the project prebuild writes. */
const PBXPROJ = `// !$*UTF8*$!
{
	archiveVersion = 1;
	classes = {};
	objectVersion = 46;
	objects = {
/* Begin PBXNativeTarget section */
		AAAAAAAAAAAAAAAAAAAAAAA1 /* GatherPreview */ = {
			isa = PBXNativeTarget;
			buildConfigurationList = CCCCCCCCCCCCCCCCCCCCCCC1;
			buildPhases = ();
			buildRules = ();
			dependencies = ();
			name = GatherPreview;
			productName = GatherPreview;
			productType = "com.apple.product-type.application";
		};
		AAAAAAAAAAAAAAAAAAAAAAA2 /* ShareExtension */ = {
			isa = PBXNativeTarget;
			buildConfigurationList = CCCCCCCCCCCCCCCCCCCCCCC2;
			buildPhases = ();
			buildRules = ();
			dependencies = ();
			name = ShareExtension;
			productName = ShareExtension;
			productType = "com.apple.product-type.app-extension";
		};
		AAAAAAAAAAAAAAAAAAAAAAA3 /* widgets */ = {
			isa = PBXNativeTarget;
			buildConfigurationList = CCCCCCCCCCCCCCCCCCCCCCC3;
			buildPhases = ();
			buildRules = ();
			dependencies = ();
			name = widgets;
			productName = widgets;
			productType = "com.apple.product-type.app-extension";
		};
/* End PBXNativeTarget section */
/* Begin XCBuildConfiguration section */
		BBBBBBBBBBBBBBBBBBBBBBB1 /* Release */ = {
			isa = XCBuildConfiguration;
			buildSettings = { INFOPLIST_FILE = GatherPreview/Info.plist; };
			name = Release;
		};
		BBBBBBBBBBBBBBBBBBBBBBB2 /* Release */ = {
			isa = XCBuildConfiguration;
			buildSettings = { INFOPLIST_FILE = "ShareExtension/ShareExtension-Info.plist"; };
			name = Release;
		};
		BBBBBBBBBBBBBBBBBBBBBBB3 /* Release */ = {
			isa = XCBuildConfiguration;
			buildSettings = { INFOPLIST_FILE = ../targets/widgets/Info.plist; };
			name = Release;
		};
/* End XCBuildConfiguration section */
/* Begin XCConfigurationList section */
		CCCCCCCCCCCCCCCCCCCCCCC1 = { isa = XCConfigurationList; buildConfigurations = (BBBBBBBBBBBBBBBBBBBBBBB1 /* Release */); defaultConfigurationName = Release; };
		CCCCCCCCCCCCCCCCCCCCCCC2 = { isa = XCConfigurationList; buildConfigurations = (BBBBBBBBBBBBBBBBBBBBBBB2 /* Release */); defaultConfigurationName = Release; };
		CCCCCCCCCCCCCCCCCCCCCCC3 = { isa = XCConfigurationList; buildConfigurations = (BBBBBBBBBBBBBBBBBBBBBBB3 /* Release */); defaultConfigurationName = Release; };
/* End XCConfigurationList section */
	};
	rootObject = DDDDDDDDDDDDDDDDDDDDDDD1;
}
`

const plist = (entries: Record<string, string>) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>${Object.entries(entries)
    .map(([key, value]) => `<key>${key}</key><string>${value}</string>`)
    .join('')}</dict></plist>`

let dir: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'extension-versions-'))
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

function parse() {
  const file = path.join(dir, 'project.pbxproj')
  fs.writeFileSync(file, PBXPROJ)
  const project = xcode.project(file)
  project.parseSync()
  return project
}

const phasesOf = (project: ReturnType<typeof parse>, name: string) => {
  const target = Object.values<{ name: string; buildPhases: { comment: string }[] }>(
    project.pbxNativeTargetSection(),
  ).find((candidate) => typeof candidate === 'object' && candidate.name === name)
  return (target?.buildPhases ?? []).filter(({ comment }) => comment === PHASE_NAME)
}

describe('addVersionSyncPhases', () => {
  test('adds one phase to each app extension and none to the app', () => {
    const project = parse()
    expect(addVersionSyncPhases(project)).toEqual(['ShareExtension', 'widgets'])
    expect(phasesOf(project, 'ShareExtension')).toHaveLength(1)
    expect(phasesOf(project, 'widgets')).toHaveLength(1)
    expect(phasesOf(project, 'GatherPreview')).toHaveLength(0)
  })

  test('is idempotent', () => {
    const project = parse()
    addVersionSyncPhases(project)
    expect(addVersionSyncPhases(project)).toEqual([])
    expect(phasesOf(project, 'widgets')).toHaveLength(1)
  })

  test("reads the app's source plist, declares it, and runs on every build", () => {
    const project = parse()
    addVersionSyncPhases(project)
    const [phase] = Object.values<Record<string, unknown>>(project.hash.project.objects.PBXShellScriptBuildPhase).filter(
      (candidate) => typeof candidate === 'object',
    )
    expect(phase.shellScript).toContain('GatherPreview/Info.plist')
    expect(phase.inputPaths).toEqual(['"$(SRCROOT)/GatherPreview/Info.plist"'])
    expect(phase.outputPaths).toEqual(['"$(TARGET_BUILD_DIR)/$(INFOPLIST_PATH)"'])
    expect(phase.alwaysOutOfDate).toBe(1)
  })

  test('fails loudly when the app target has no Info.plist', () => {
    const project = parse()
    project.pbxXCBuildConfigurationSection().BBBBBBBBBBBBBBBBBBBBBBB1.buildSettings = {}
    expect(() => addVersionSyncPhases(project)).toThrow(/INFOPLIST_FILE/)
  })
})

describe('the version sync script', () => {
  function run(app: Record<string, string>, extension: Record<string, string>) {
    const appPlist = path.join(dir, 'src/App/Info.plist')
    const extensionPlist = path.join(dir, 'build/x.appex/Info.plist')
    fs.mkdirSync(path.dirname(appPlist), { recursive: true })
    fs.mkdirSync(path.dirname(extensionPlist), { recursive: true })
    fs.writeFileSync(appPlist, plist(app))
    fs.writeFileSync(extensionPlist, plist(extension))
    // The built plist is binary on iOS; the script has to cope with that.
    execFileSync('plutil', ['-convert', 'binary1', extensionPlist])
    execFileSync('/bin/sh', ['-c', versionSyncScript('App/Info.plist')], {
      env: {
        ...process.env,
        SRCROOT: path.join(dir, 'src'),
        TARGET_BUILD_DIR: path.join(dir, 'build'),
        INFOPLIST_PATH: 'x.appex/Info.plist',
        PRODUCT_NAME: 'x',
      },
    })
    return JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', extensionPlist], { encoding: 'utf8' }))
  }

  const onMac = process.platform === 'darwin'

  test.runIf(onMac)("copies the app's build number and version into the extension", () => {
    expect(
      run(
        { CFBundleVersion: '9', CFBundleShortVersionString: '1.0.0' },
        { CFBundleVersion: '1', CFBundleShortVersionString: '1.0' },
      ),
    ).toEqual({ CFBundleVersion: '9', CFBundleShortVersionString: '1.0.0' })
  })

  test.runIf(onMac)('adds a key the extension lacks', () => {
    expect(run({ CFBundleVersion: '9' }, {})).toEqual({ CFBundleVersion: '9' })
  })

  test.runIf(onMac)('leaves the extension alone while the app plist holds build-setting references', () => {
    expect(
      run(
        { CFBundleVersion: '$(CURRENT_PROJECT_VERSION)', CFBundleShortVersionString: '$(MARKETING_VERSION)' },
        { CFBundleVersion: '1', CFBundleShortVersionString: '1.0' },
      ),
    ).toEqual({ CFBundleVersion: '1', CFBundleShortVersionString: '1.0' })
  })
})
