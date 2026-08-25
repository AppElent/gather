/**
 * What appending to a note actually writes.
 *
 * The commit itself is mutations behind a React hook and is verified on a
 * device. This one function is not: it decides the shape of somebody's note, it
 * runs on text nobody controls, and getting it wrong is the kind of bug that is
 * only noticed after a fortnight of shares have gone into the same note.
 */
import { describe, expect, test } from 'vitest'

import { appendedBody } from './drop'

describe('adding to a note that already exists', () => {
  test('goes at the bottom, after a blank line', () => {
    expect(appendedBody('What we said', 'https://example.com')).toBe(
      'What we said\n\nhttps://example.com',
    )
  })

  test('an empty note does not start with a blank line', () => {
    expect(appendedBody('', 'https://example.com')).toBe('https://example.com')
    expect(appendedBody('   \n\n', 'first thing')).toBe('first thing')
  })

  test('trailing whitespace never compounds into a growing gap', () => {
    expect(appendedBody('One\n\n\n', 'Two')).toBe('One\n\nTwo')
  })

  test('nothing to add leaves the note as it was', () => {
    expect(appendedBody('Untouched', '')).toBe('Untouched')
  })
})
