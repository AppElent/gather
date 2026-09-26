import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'

/**
 * UTF-8 read back as Windows-1252 and saved again turns a curly quote or a
 * bullet into a three-character sequence starting with a-circumflex, and the
 * result is still valid UTF-8, so nothing else notices. It reached the note
 * toolbar and two delete confirmations before anyone saw it. The pattern is
 * written with escapes so this file passes its own check.
 */
const MOJIBAKE = /\u00e2\u20ac|\u00e2\u02dc|\u00c3[\u0080-\u00bf]/

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name: string) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx)$/.test(name) ? [path] : []
  })
}

describe('mobile source encoding', () => {
  const root = join(__dirname, '../apps/mobile')
  const files = ['src', 'app'].flatMap((dir) => sourceFiles(join(root, dir)))

  test.each(files)('%s has no double-encoded UTF-8', (file) => {
    expect(readFileSync(file, 'utf8')).not.toMatch(MOJIBAKE)
  })
})
