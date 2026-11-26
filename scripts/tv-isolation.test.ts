/**
 * The Apple TV app aliases `react-native` to a fork (ADR 0052). A leak of the
 * fork into the phone, or a moved React Native, would break installed iPhone
 * apps, so the lockfile must keep the two apart.
 */
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, expect, test, vi } from 'vitest'
import phoneConfig from '../apps/mobile/app.config'
import tvConfig from '../apps/tv/app.config'

const repo = path.resolve(__dirname, '..')
const lockfile = fs.readFileSync(path.join(repo, 'pnpm-lock.yaml'), 'utf8')

afterEach(() => vi.unstubAllEnvs())

/** The lockfile's `importers` block for one workspace package. */
function importer(name: string): string {
  const [, rest] = lockfile.split(`\n  ${name}:\n`)
  if (rest === undefined) throw new Error(`no importer ${name}`)
  return rest.split(/\n {2}\S/)[0]
}

/** One top-level lockfile section, as entry key to the [name, version] pairs it depends on. */
function entries(lock: string, section: string) {
  const body = lock.split(`\n${section}:\n`)[1]?.split(/\n(?=\S)/)[0]
  if (body === undefined) throw new Error(`no ${section} section`)
  const unquote = (text: string) => text.replace(/^'(.*)'$/, '$1')
  const found = new Map<string, [name: string, version: string][]>()
  let dependencies: [string, string][] = []
  let inDependencies = false
  let name = ''
  for (const line of body.split('\n')) {
    const [, indent, key, value] = /^( +)('[^']+'|\S+?):(?: (.+))?$/.exec(line) ?? []
    if (key === undefined) continue
    if (indent.length === 2) {
      dependencies = []
      found.set(unquote(key), dependencies)
    } else if (indent.length === 4) {
      inDependencies = /^(dev|optional)?dependencies$/i.test(key)
    } else if (inDependencies && indent.length === 6) {
      name = unquote(key)
      if (value) dependencies.push([name, unquote(value)])
    } else if (inDependencies && key === 'version') {
      dependencies.push([name, unquote(value)])
    }
  }
  return found
}

/** What `importerName` reaches, workspace links included, each with the path to it. */
function closure(lock: string, importerName: string): Map<string, string[]> {
  const importers = entries(lock, 'importers')
  const snapshots = entries(lock, 'snapshots')
  const reached = new Map<string, string[]>([[importerName, [importerName]]])
  // A Map iterates entries added during the loop, so this visits the whole closure.
  for (const [id, trail] of reached) {
    const dependencies = importers.get(id) ?? snapshots.get(id)
    // Failing on an edge the walk cannot follow keeps it from passing unseen.
    if (!dependencies) throw new Error(`cannot resolve ${trail.join(' > ')}`)
    for (const [name, version] of dependencies) {
      const target = version.startsWith('link:')
        ? path.posix.join(importers.has(id) ? id : '.', version.slice('link:'.length))
        : snapshots.has(version) // an alias spells out the package it resolves
          ? version
          : `${name}@${version}`
      if (!reached.has(target)) reached.set(target, [...trail, target])
    }
  }
  return reached
}

/** The dependency paths by which one workspace package reaches the tvOS fork. */
function forkPaths(lock: string, importerName: string) {
  return [...closure(lock, importerName)]
    .filter(([id]) => /^@?react-native-tvos[@/]/.test(id))
    .map(([, trail]) => trail.join(' > '))
}

function reactNative(name: string) {
  return /\n {6}react-native:\n {8}specifier: (.+)\n {8}version: ([^(\n]+)/
    .exec(importer(name))
    ?.slice(1)
}

test('the phone resolves stock react-native', () => {
  expect(reactNative('apps/mobile')).toEqual(['0.88.1', '0.88.1'])
  expect(importer('apps/mobile')).not.toContain('react-native-tvos')
})

test('nothing the phone depends on, directly or transitively, resolves the tvOS fork', () => {
  expect(forkPaths(lockfile, 'apps/mobile')).toEqual([])
})

test('a fork that only a transitive phone dependency resolves is found', () => {
  const leaked = `lockfileVersion: '9.0'

importers:

  apps/mobile:
    dependencies:
      '@gather/core':
        specifier: workspace:*
        version: link:../../packages/core
      direct:
        specifier: 1.0.0
        version: 1.0.0(0123abc)

  packages/core:
    devDependencies:
      from-core:
        specifier: 1.0.0
        version: 1.0.0

packages:

snapshots:

  '@scope/nested@1.0.0':
    optionalDependencies:
      react-native: react-native-tvos@0.88.1-0(react@19.3.0)

  direct@1.0.0(0123abc):
    dependencies:
      '@scope/nested': 1.0.0
    transitivePeerDependencies:
      - supports-color

  from-core@1.0.0:
    dependencies:
      '@react-native-tvos/virtualized-lists': 0.88.1-0

  '@react-native-tvos/virtualized-lists@0.88.1-0': {}

  react-native-tvos@0.88.1-0(react@19.3.0): {}
`
  expect(forkPaths(leaked, 'apps/mobile')).toEqual([
    'apps/mobile > packages/core > from-core@1.0.0 > @react-native-tvos/virtualized-lists@0.88.1-0',
    'apps/mobile > direct@1.0.0(0123abc) > @scope/nested@1.0.0 > react-native-tvos@0.88.1-0(react@19.3.0)',
  ])
  expect(() =>
    forkPaths(leaked.replace('direct@1.0.0(0123abc):', 'direct@2.0.0:'), 'apps/mobile'),
  ).toThrow('cannot resolve apps/mobile > direct@1.0.0(0123abc)')
})

test('the TV app resolves the tvOS fork', () => {
  expect(forkPaths(lockfile, 'apps/tv')).not.toEqual([])
  expect(reactNative('apps/tv')).toEqual([
    'npm:react-native-tvos@0.88.1-0',
    'react-native-tvos@0.88.1-0',
  ])
})

test.each(['production', 'preview', 'development'])(
  "the TV app takes the phone app's identity for %s",
  (variant) => {
    vi.stubEnv('APP_VARIANT', variant)
    const identity = (appConfig: typeof tvConfig) => {
      const { name, scheme, ios } = appConfig({ config: {} } as Parameters<typeof tvConfig>[0])
      return { name, scheme, id: ios?.bundleIdentifier, team: ios?.appleTeamId }
    }
    expect(identity(tvConfig).id).toMatch(/^com\.appelent\.gather/)
    expect(identity(tvConfig)).toEqual(identity(phoneConfig))
  },
)

/**
 * expo-updates reports tvOS as `ios`, so only the EAS project keeps a TV update
 * off phones: the TV app has its own project, update URL and channels (APP-860).
 */
const appJson = (app: string) =>
  JSON.parse(fs.readFileSync(path.join(repo, 'apps', app, 'app.json'), 'utf8')).expo
const easJson = (app: string) =>
  JSON.parse(fs.readFileSync(path.join(repo, 'apps', app, 'eas.json'), 'utf8'))

test('a TV update cannot reach a phone build: the TV app has its own EAS project', () => {
  const phone = appJson('mobile')
  const tv = appJson('tv')
  const tvProject = tv.extra?.eas?.projectId
  expect(tvProject).toMatch(/^[0-9a-f-]{36}$/)
  expect(tvProject).not.toBe(phone.extra.eas.projectId)
  expect(tv.slug).not.toBe(phone.slug)
  expect(tv.updates.url).toBe(`https://u.expo.dev/${tvProject}`)
  expect(tv.updates.url).not.toBe(phone.updates.url)
  expect(tv.owner).toBe(phone.owner)
})

test.each(['production', 'preview', 'development'])(
  'the TV app has a %s build profile on its own channel',
  (variant) => {
    const profile = easJson('tv').build[variant]
    expect(profile).toMatchObject({
      channel: variant,
      environment: variant,
      env: { APP_VARIANT: variant, EXPO_TV: '1' },
    })
  },
)

test('the TV build number comes from its own project, separate from the phone', () => {
  expect(easJson('tv').cli.appVersionSource).toBe('remote')
  for (const variant of ['production', 'preview']) {
    expect(easJson('tv').build[variant].autoIncrement).toBe(true)
  }
})
