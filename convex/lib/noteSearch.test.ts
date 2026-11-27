import { describe, expect, test } from 'vitest'
import { EXCERPT_MAX, noteExcerpt } from './noteSearch'

describe('noteExcerpt', () => {
  test('is the first line with anything on it, trimmed', () => {
    expect(noteExcerpt('\n  Call Piet\nthen wait')).toBe('Call Piet')
    expect(noteExcerpt(' \r\n\t\n Boiler \r\nnext')).toBe('Boiler')
    expect(noteExcerpt('')).toBe('')
    expect(noteExcerpt(' \n\t\n')).toBe('')
  })

  test('keeps a first line of exactly the cap whole', () => {
    const line = 'a'.repeat(EXCERPT_MAX)
    expect(noteExcerpt(`${line}\nmore`)).toBe(line)
  })

  test('cuts a note of one long line, so the body is not returned twice', () => {
    const body = 'word '.repeat(20_000)
    const excerpt = noteExcerpt(body)
    expect(excerpt).toBe(`${body.slice(0, EXCERPT_MAX).trimEnd()}…`)
  })

  test('never splits a surrogate pair at the cut', () => {
    const body = `${'a'.repeat(EXCERPT_MAX - 1)}😀😀`
    expect(noteExcerpt(body)).toBe(`${'a'.repeat(EXCERPT_MAX - 1)}…`)
  })
})
