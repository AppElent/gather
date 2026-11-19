import { describe, expect, it } from 'vitest'

import { editedRead, ingredientsDigest, pickRows, type SourceLine } from './pick'

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
