/**
 * The connected-app gate only holds while nothing reads identity around it
 * (ADR-0046): every identity goes through `lib/connectedApps.ts`, and every
 * public action gates itself, because the queries it runs cannot tell that
 * their caller could write.
 */
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { expect, test } from 'vitest'

const root = path.dirname(new URL(import.meta.url).pathname)

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory())
      return entry.name === '_generated' || entry.name === '__fixtures__'
        ? []
        : sources(full)
    return /\.ts$/.test(entry.name) && !/\.test\.ts$/.test(entry.name)
      ? [full]
      : []
  })
}

test('only lib/connectedApps.ts reads ctx.auth', () => {
  const readers = sources(root)
    .filter((file) => /\.auth\.getUserIdentity\(/.test(readFileSync(file, 'utf8')))
    .map((file) => path.relative(root, file))
  expect(readers).toEqual(['lib/connectedApps.ts'])
})

test('every public action resolves a gated identity first', () => {
  const ungated: string[] = []
  for (const file of sources(root)) {
    const text = readFileSync(file, 'utf8')
    for (const match of text.matchAll(
      /export const (\w+) = action\(\{[\s\S]*?handler: async [^{]*\{([\s\S]{0,400})/g,
    )) {
      if (
        !/(requireIdentity|getGatedIdentity|rejectConnectedApps)\(ctx\)/.test(
          match[2],
        )
      )
        ungated.push(`${path.relative(root, file)}:${match[1]}`)
    }
  }
  expect(ungated).toEqual([])
})
