import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

/**
 * Every route below an index renders `<Breadcrumbs>`
 * (docs/contracts/navigation.md): a page you can enter has a way back.
 *
 * The route files are one-liners that render a page component, so the trail
 * is looked for in the route file and in the files it imports.
 */
const APP = join(process.cwd(), 'src/routes/_app')

/** Nested routes with no trail, and why. */
const WITHOUT_TRAIL: Record<string, string> = {
  'nutrition/add': 'a sheet over the diary, which stays mounted under it',
  'integrations/callback': 'the OAuth return, not a page anyone navigates to',
}

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return routeFiles(path)
    return entry.name.endsWith('.tsx') ? [path] : []
  })
}

/** `baby/$babyId.index.tsx` → `baby/$babyId`, the address it serves. */
function addressOf(file: string): string {
  return relative(APP, file)
    .replace(/\.tsx$/, '')
    .replaceAll('.', '/')
    .replace(/(^|\/)index$/, '')
}

function importedFiles(file: string): string[] {
  const source = readFileSync(file, 'utf8')
  return [...source.matchAll(/from '(\.{1,2}\/[^']+)'/g)].flatMap(
    ([, specifier]) =>
      ['.tsx', '.ts']
        .map((extension) => resolve(dirname(file), specifier + extension))
        .filter((path) => existsSync(path)),
  )
}

const NESTED = routeFiles(APP)
  .map((file) => ({ file, address: addressOf(file) }))
  .filter(({ address }) => address.includes('/'))

describe('every route below an index', () => {
  test('there are some, or this walk has stopped finding them', () => {
    expect(NESTED.map(({ address }) => address)).toContain('recipes/$recipeId')
  })

  const pages = NESTED.filter(({ address }) => !(address in WITHOUT_TRAIL))
  test.each(pages.map(({ file, address }) => [address, file]))(
    '%s renders a trail back to its index',
    (_address, file) => {
      const sources = [file, ...importedFiles(file)].map((path) =>
        readFileSync(path, 'utf8'),
      )
      expect(sources.some((source) => source.includes('<Breadcrumbs'))).toBe(
        true,
      )
    },
  )

  test('every exception is still a nested route', () => {
    const addresses = NESTED.map(({ address }) => address)
    for (const address of Object.keys(WITHOUT_TRAIL)) {
      expect(addresses).toContain(address)
    }
  })
})
