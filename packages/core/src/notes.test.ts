import { describe, expect, test } from 'vitest'
import { en, nl } from './messages'
import { isNoteTooLong, NOTE_MAX_CHARS } from './notes'
import { noteRefusal, noteRefusalSentence } from './refusals'

test('title and body count together', () => {
  const body = 'a'.repeat(NOTE_MAX_CHARS - 1)
  expect(isNoteTooLong({ title: 'a', body })).toBe(false)
  expect(isNoteTooLong({ title: 'ab', body })).toBe(true)
})

describe('the refusal', () => {
  test.each([
    ['en', en],
    ['nl', nl],
  ] as const)('reads in %s, and names the limit', (locale, messages) => {
    expect(
      noteRefusalSentence(
        { data: noteRefusal('too-long') },
        messages.notes.refusals,
      ),
    ).toContain(NOTE_MAX_CHARS.toLocaleString(locale))
  })

  test('is nothing for another error', () => {
    expect(noteRefusalSentence(new Error('x'), en.notes.refusals)).toBe(null)
  })
})
