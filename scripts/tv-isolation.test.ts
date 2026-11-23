/**
 * The Apple TV app aliases `react-native` to a fork (ADR 0052). A leak of the
 * fork into the phone, or a moved React Native, would break installed iPhone
 * apps, so the lockfile must keep the two apart.
 */
import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from 'vitest'

const repo = path.resolve(__dirname, '..')
const lockfile = fs.readFileSync(path.join(repo, 'pnpm-lock.yaml'), 'utf8')

/** The lockfile's `importers` block for one workspace package. */
function importer(name: string): string {
  const [, rest] = lockfile.split(`\n  ${name}:\n`)
  if (rest === undefined) throw new Error(`no importer ${name}`)
  return rest.split(/\n {2}\S/)[0]
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

test('the TV app resolves the tvOS fork', () => {
  expect(reactNative('apps/tv')).toEqual([
    'npm:react-native-tvos@0.88.1-0',
    'react-native-tvos@0.88.1-0',
  ])
})

test('the TV app takes the phone app\'s identity per variant', () => {
  const identity = (app: string) =>
    fs
      .readFileSync(path.join(repo, app, 'app.config.ts'), 'utf8')
      .match(/(suffix: '[^']*'|name: '[^']*'|scheme: '[^']*'|TEAM_ID = '\w+')/g)
  expect(identity('apps/tv')).toEqual(identity('apps/mobile'))
})
