import { describe, expect, it } from 'vitest'

import {
  byLineKey,
  editedRead,
  ingredientsDigest,
  type PickRow,
  pickRows,
  type SourceLine,
  sectionsByAisle,
  withEdits,
} from './pick'

const line = (
  key: string,
  name: string,
  quantity?: number,
  unit?: 'g' | 'blik' | 'el',
  via: 'local' | 'ai' | 'ai-earlier' = 'local',
): SourceLine => ({
  key,
  text: `${quantity ?? ''} ${unit ?? ''} ${name}`.trim(),
  read: {
    kind: 'read',
    via,
    name,
    ...(quantity !== undefined ? { quantity } : {}),
    ...(unit ? { unit } : {}),
  },
  servings: 4,
})

describe('pickRows', () => {
  it('scales to the servings, merges what is on the list and adds the rest', () => {
    const { rows, lines, reading } = pickRows({
      lines: [line('0', 'Eieren', 6), line('1', 'Feta', 200, 'g')],
      servings: 6,
      items: [{ id: 'a', title: 'Eieren', quantity: 10, done: false }],
      ticks: {},
    })
    expect(reading).toBe(false)
    expect(rows[0]).toMatchObject({
      title: 'Eieren',
      amount: { quantity: 9 },
      on: true,
      meta: { kind: 'merge', from: { quantity: 10 }, to: { quantity: 19 } },
    })
    expect(rows[1]).toMatchObject({ amount: { quantity: 300, unit: 'g' }, meta: null })
    expect(lines).toEqual([
      { title: 'Eieren', quantity: 9 },
      { title: 'Feta', quantity: 300, unit: 'g' },
    ])
  })

  it('leaves an unticked row out of the lines', () => {
    const { rows, lines } = pickRows({
      lines: [line('0', 'Eieren', 6), line('1', 'Ui', 1)],
      items: [],
      ticks: { '0': false },
    })
    expect(rows[0].on).toBe(false)
    expect(lines).toEqual([{ title: 'Ui', quantity: 1 }])
  })

  it('starts a row the house has in stock unticked, and says so', () => {
    const { rows, lines } = pickRows({
      lines: [line('0', 'Olijfolie', 2, 'el'), line('1', 'Ui', 1)],
      items: [],
      ticks: {},
      inStock: (name) => name === 'Olijfolie',
    })
    expect(rows[0]).toMatchObject({ on: false, meta: { kind: 'inStock', adding: false } })
    expect(lines).toHaveLength(1)
    const ticked = pickRows({
      lines: [line('0', 'Olijfolie', 2, 'el')],
      items: [],
      ticks: { '0': true },
      inStock: () => true,
    })
    expect(ticked.rows[0].meta).toEqual({ kind: 'inStock', adding: true })
  })

  it('names lines the AI read, waits for lines it is reading, and keeps text as written', () => {
    const { rows, lines, reading } = pickRows({
      lines: [
        line('0', 'Chilivlokken', 1, undefined, 'ai'),
        line('1', 'Koriander', 1, undefined, 'ai-earlier'),
        { key: '2', text: 'een handje munt', read: { kind: 'reading' } },
        { key: '3', text: 'wat zout', read: { kind: 'text' } },
      ],
      items: [],
      ticks: {},
    })
    expect(rows.map((row) => row.meta)).toEqual([
      { kind: 'ai', earlier: false },
      { kind: 'ai', earlier: true },
      { kind: 'reading' },
      { kind: 'text' },
    ])
    expect(reading).toBe(true)
    expect(lines.map((added) => added.title)).toEqual([
      'Chilivlokken',
      'Koriander',
      'wat zout',
    ])
  })

  it('says a line without an amount is already on the list', () => {
    const { rows } = pickRows({
      lines: [{ key: '0', text: 'Zout', read: { kind: 'read', via: 'local', name: 'Zout' } }],
      items: [{ id: 'a', title: 'Zout', done: false }],
      ticks: {},
    })
    expect(rows[0].meta).toEqual({ kind: 'already' })
  })

  it('does not scale a line retyped in the sheet', () => {
    const edited: SourceLine = { key: '0', text: '6 eieren', read: editedRead('3 eieren'), servings: 4 }
    const { rows } = pickRows({ lines: [edited], servings: 8, items: [], ticks: {} })
    expect(rows[0]).toMatchObject({ title: 'Eieren', amount: { quantity: 3 } })
  })
})

describe('ingredientsDigest', () => {
  it('changes when the ingredients change', () => {
    const one = ingredientsDigest(['2 uien', '1 blik tomaten'])
    expect(ingredientsDigest(['2 uien', '1 blik tomaten'])).toBe(one)
    expect(ingredientsDigest(['3 uien', '1 blik tomaten'])).not.toBe(one)
  })
})

describe('keys a line had before (APP-423)', () => {
  const reading: SourceLine = { key: 'di:3', text: 'een handje koriander', read: { kind: 'reading' } }
  // The AI answered: the line is now an item's row under another key.
  const arrived: SourceLine = { ...line('item:koriander:0', 'Koriander', 1), was: ['di:3'] }

  it('a tick made while the line was being read survives its answer', () => {
    // Unticked while reading: the row is off, and still off once it is read.
    expect(pickRows({ lines: [reading], items: [], ticks: { 'di:3': false } }).rows[0].on).toBe(false)
    const after = pickRows({ lines: [arrived], items: [], ticks: { 'di:3': false } })
    expect(after.rows[0]).toMatchObject({ title: 'Koriander', on: false })
    expect(after.lines).toEqual([])
    // Without the earlier key the tick is lost, which is the bug.
    expect(
      pickRows({ lines: [{ ...arrived, was: undefined }], items: [], ticks: { 'di:3': false } }).rows[0].on,
    ).toBe(true)
  })

  it('its own key wins over an earlier one, and the first earlier key with an answer wins', () => {
    expect(byLineKey({ 'item:koriander:0': true, 'di:3': false }, arrived)).toBe(true)
    expect(byLineKey({ 'ma:1': false, 'di:3': true }, { key: 'x', was: ['do:2', 'ma:1', 'di:3'] })).toBe(false)
    expect(byLineKey({}, arrived)).toBeUndefined()
  })

  it('a retype made while the line was being read is on the row it became', () => {
    const typed = editedRead('3 bosjes koriander')
    const [shown] = withEdits([arrived], { 'di:3': typed })
    expect(shown.read).toEqual(typed)
    const { rows } = pickRows({ lines: [shown], items: [], ticks: { 'di:3': true } })
    expect(rows[0]).toMatchObject({ title: 'Koriander', amount: { quantity: 3, unit: 'bos' }, on: true })
    // Lines nobody retyped are as they were.
    expect(withEdits([arrived], {})[0]).toBe(arrived)
  })
})

describe('a tick made on a line still being read (APP-479)', () => {
  // The list already has enough Koriander; the AI answered after the tick.
  const items = [{ id: 'a', title: 'Koriander', quantity: 5, done: false }]
  const arrived: SourceLine = {
    ...line('item:koriander:0', 'Koriander', 1),
    was: ['di:3'],
    topUp: true,
  }

  it('tops up instead of adding the whole amount', () => {
    const { rows, lines } = pickRows({ lines: [arrived], items, ticks: { 'di:3': true } })
    // On, as the person left it, but the list has enough: nothing to add.
    expect(rows[0]).toMatchObject({ on: true, meta: { kind: 'covered' } })
    expect(lines).toEqual([])
  })

  it('a covered row ticked by hand under its own key still adds its whole amount', () => {
    const { lines } = pickRows({ lines: [arrived], items, ticks: { 'item:koriander:0': true } })
    expect(lines).toEqual([{ title: 'Koriander', quantity: 1 }])
  })
})

describe('lines still being read as text (APP-479)', () => {
  const reading: SourceLine = { key: 'di:3', text: 'een handje munt', read: { kind: 'reading' } }

  it('holds the button back by default, and adds them as written when asked', () => {
    const lines = [line('0', 'Ui', 1), reading]
    const waiting = pickRows({ lines, items: [], ticks: {} })
    expect(waiting.reading).toBe(true)
    expect(waiting.lines.map((added) => added.title)).toEqual(['Ui'])
    const now = pickRows({ lines, items: [], ticks: {}, readingAsText: true })
    expect(now.reading).toBe(false)
    expect(now.lines.map((added) => added.title)).toEqual(['Ui', 'een handje munt'])
    // The row still says it is being read.
    expect(now.rows[1].meta).toEqual({ kind: 'reading' })
  })

  it('leaves an unticked reading line out either way', () => {
    const { lines } = pickRows({ lines: [reading], items: [], ticks: { 'di:3': false }, readingAsText: true })
    expect(lines).toEqual([])
  })
})

describe('sectionsByAisle', () => {
  const row = (key: string, title: string, meta: PickRow['meta'] = null): PickRow => ({
    key,
    title,
    amount: {},
    on: true,
    meta,
  })

  it('groups by the aisle asked for, in walking order, reading and text rows under Other', () => {
    // The Group files Penne under snacks, whatever the dictionary says.
    const aisleOf = (title: string) => (title === 'Penne' ? 'snacks' : title === 'Eieren' ? 'dairy' : 'produce')
    const sections = sectionsByAisle(
      [
        row('0', 'Penne'),
        row('1', 'Eieren'),
        row('2', 'Ui'),
        row('3', 'Koriander', { kind: 'reading' }),
        row('4', 'iets onduidelijks', { kind: 'text' }),
      ],
      aisleOf,
    )
    expect(sections.map((s) => [s.id, s.rows.map((r) => r.key)])).toEqual([
      ['produce', ['2']],
      ['dairy', ['1']],
      ['snacks', ['0']],
      ['other', ['3', '4']],
    ])
  })
})
