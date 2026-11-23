import { describe, expect, test } from 'vitest'

import { composedNote, emptyNoteDraft, isNoteDirty } from './noteDraft'

const draft = (rest: Partial<ReturnType<typeof emptyNoteDraft>>) => ({
  ...emptyNoteDraft('composer-test'),
  ...rest,
})

describe('the note a draft saves', () => {
  test('needs a title or a line of body', () => {
    expect(composedNote(draft({}))).toBeNull()
    expect(composedNote(draft({ title: '   ', body: '\n  \n' }))).toBeNull()
    expect(composedNote(draft({ pinned: true }))).toBeNull()
  })

  test('saves title, body and pinned, trimming only the ends', () => {
    expect(
      composedNote(
        draft({ title: '  Wifi ', body: '\n\n  netwerk: gast\nwachtwoord\n\n', pinned: true }),
      ),
    ).toEqual({ title: 'Wifi', body: '  netwerk: gast\nwachtwoord', pinned: true })
  })

  test('a body without a title saves untitled', () => {
    expect(composedNote(draft({ body: 'Paklijst' }))).toEqual({
      title: '',
      body: 'Paklijst',
      pinned: false,
    })
  })
})

describe('a draft kept on close', () => {
  test('is kept once something was typed or pinned', () => {
    expect(isNoteDirty(draft({}))).toBe(false)
    expect(isNoteDirty(draft({ title: ' ' }))).toBe(false)
    expect(isNoteDirty(draft({ title: 'a' }))).toBe(true)
    expect(isNoteDirty(draft({ body: 'a' }))).toBe(true)
    expect(isNoteDirty(draft({ pinned: true }))).toBe(true)
  })

  test('a new draft has its own save key', () => {
    expect(emptyNoteDraft().saveKey).not.toBe(emptyNoteDraft().saveKey)
    expect(emptyNoteDraft().saveKey.length).toBeGreaterThanOrEqual(8)
  })
})
