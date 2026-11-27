import { expect, test } from 'vitest'

import {
  addedSummary,
  amountSpans,
  composedGrocery,
  emptyGroceryDraft,
  type GroceryDraft,
  isGroceryDirty,
  lineSpans,
  nextGroceryDraft,
  quantityChoices,
  repeatPart,
  withAmount,
  withLine,
  withoutRepeat,
  withRepeat,
} from './groceryDraft'

// A Friday.
const TODAY = '2026-11-27'

const draft = (over: Partial<GroceryDraft> = {}): GroceryDraft => ({
  ...emptyGroceryDraft(),
  ...over,
})
const highlighted = (line: string) =>
  amountSpans(draft({ line })).map(({ start, end }) => line.slice(start, end))

test('the line fills the amount', () => {
  expect(composedGrocery(draft({ line: '2 pak melk' }), TODAY)).toEqual({
    title: 'melk',
    quantity: 2,
    unit: 'pak',
    staple: false,
  })
})

test('the amount is highlighted wherever it stands, and only the amount', () => {
  expect(highlighted('2 pak melk')).toEqual(['2 pak'])
  expect(highlighted('  2 pak  volle  melk ')).toEqual(['2 pak'])
  expect(highlighted('kipfilet 500 gram')).toEqual(['500 gram'])
  expect(highlighted('melk x2')).toEqual(['x2'])
  expect(highlighted('zak sla')).toEqual(['zak'])
  expect(highlighted('bag of rice')).toEqual(['bag of'])
  expect(highlighted('2 c++ (groot)')).toEqual(['2'])
  expect(highlighted('melk')).toEqual([])
})

test('a tapped amount takes the typed one out of the line', () => {
  const tapped = withAmount(draft({ line: '2 pak melk' }), { quantity: 3, unit: 'pak' })
  expect(tapped.line).toBe('melk')
  expect(composedGrocery(tapped, TODAY)).toMatchObject({ title: 'melk', quantity: 3, unit: 'pak' })
  expect(amountSpans(tapped)).toEqual([])
  // Kept while the name goes on being typed, replaced by a newly typed amount.
  expect(composedGrocery(withLine(tapped, 'melk halfvol'), TODAY).quantity).toBe(3)
  expect(composedGrocery(withLine(tapped, '6 melk'), TODAY)).toMatchObject({
    title: 'melk',
    quantity: 6,
  })
})

test('a removed amount leaves the words as the name', () => {
  const removed = draft({ line: '6 eieren', amount: null })
  expect(composedGrocery(removed, TODAY)).toEqual({ title: '6 eieren', staple: false })
  expect(amountSpans(removed)).toEqual([])
  expect(composedGrocery(withLine(removed, '6 eierenn'), TODAY).title).toBe('6 eierenn')
})

test('an amount tapped before the name is typed stays with it', () => {
  const tapped = withAmount(draft(), { quantity: 2 })
  expect(composedGrocery(withLine(tapped, 'melk'), TODAY)).toMatchObject({
    title: 'melk',
    quantity: 2,
  })
})

test('a chosen aisle goes with its name only', () => {
  const chosen = draft({ line: 'kaas', aisle: 'bakery' })
  expect(withLine(chosen, 'kaas oud').aisle).toBe('bakery')
  expect(withLine(chosen, '2 kaas').aisle).toBe('bakery')
  // Another name, or a cleared line, has not been given it.
  expect(withLine(chosen, 'melk').aisle).toBeUndefined()
  expect(withLine(chosen, '').aisle).toBeUndefined()
  // Chosen before the name was typed: it is for that name.
  expect(withLine(draft({ aisle: 'frozen' }), 'f').aisle).toBe('frozen')
})

test('the next item is empty, on the same list, under its own key', () => {
  const sent = draft({ line: 'melk', note: 'groot', staple: true, listId: 'jumbo' })
  const next = nextGroceryDraft(sent)
  expect(next).toMatchObject({ line: '', note: '', staple: false, listId: 'jumbo' })
  expect(next.saveKey).not.toBe(sent.saveKey)
})

test('a close keeps what was typed or chosen, and nothing else', () => {
  expect(isGroceryDirty(draft())).toBe(false)
  expect(isGroceryDirty(draft({ listId: 'jumbo' }))).toBe(false)
  for (const over of [
    { line: 'm' },
    { note: 'groot' },
    { staple: true },
    { aisle: 'dairy' as const },
    { amount: { quantity: 2 } },
  ])
    expect(isGroceryDirty(draft(over))).toBe(true)
})

test('the menu offers amounts that fit the unit, and the current one', () => {
  expect(quantityChoices({})).toEqual([1, 2, 3, 4, 5, 6])
  expect(quantityChoices({ quantity: 10 })).toContain(10)
  expect(quantityChoices({ quantity: 400, unit: 'g' })).toEqual([
    100, 250, 400, 500, 750, 1000,
  ])
})

test('the status line names one, and counts more', () => {
  const words = { added: '{name} toegevoegd', addedMany: '{count} toegevoegd: {names}' }
  expect(addedSummary(['Melk'], words)).toBe('Melk toegevoegd')
  expect(addedSummary(['Melk', 'Bananen', 'Pindakaas'], words)).toBe(
    '3 toegevoegd: Melk, Bananen, Pindakaas',
  )
})

const WEEKLY_FRIDAY = { mode: 'fixed', unit: 'week', every: 1, weekdays: [5] }

test('the line reads a repeat as the task composer does (APP-993)', () => {
  expect(composedGrocery(draft({ line: 'koffie elke week' }), TODAY)).toEqual({
    title: 'koffie',
    repeat: WEEKLY_FRIDAY,
    staple: false,
  })
  // With an amount on either side, both are read and both highlighted.
  const line = '2 pak koffie elke 2 weken'
  expect(composedGrocery(draft({ line }), TODAY)).toMatchObject({
    title: 'koffie',
    quantity: 2,
    unit: 'pak',
    repeat: { unit: 'week', every: 2, weekdays: [5] },
  })
  expect(lineSpans(draft({ line })).map((s) => line.slice(s.start, s.end))).toEqual([
    '2 pak',
    'elke 2 weken',
  ])
  const after = 'koffie elke week 2 pak'
  expect(lineSpans(draft({ line: after })).map((s) => after.slice(s.start, s.end))).toEqual([
    'elke week',
    '2 pak',
  ])
  // Only the repeat: a date stays in the name.
  expect(composedGrocery(draft({ line: 'taart morgen' }), TODAY)).toEqual({
    title: 'taart morgen',
    staple: false,
  })
})

test('a removed repeat leaves its words in the name', () => {
  const removed = withoutRepeat(draft({ line: 'koffie elke week' }))
  expect(repeatPart(removed)).toBeUndefined()
  expect(composedGrocery(removed, TODAY)).toEqual({
    title: 'koffie elke week',
    staple: false,
  })
  // A cleared line starts over.
  expect(withLine(withLine(removed, ''), 'thee elke week').dismissed).toEqual([])
})

test('a tapped repeat takes the typed one out, and a repeat typed later wins', () => {
  const monthly = { mode: 'fixed', unit: 'month', every: 1 } as const
  const tapped = withRepeat(draft({ line: 'koffie elke week' }), monthly)
  expect(tapped.line).toBe('koffie')
  expect(composedGrocery(tapped, TODAY).repeat).toEqual(monthly)
  expect(composedGrocery(withLine(tapped, 'koffie bonen'), TODAY).repeat).toEqual(monthly)
  expect(
    composedGrocery(withLine(tapped, 'koffie dagelijks'), TODAY).repeat,
  ).toEqual({ mode: 'fixed', unit: 'day', every: 1 })
})

test('a tapped amount keeps the repeat in the line', () => {
  const tapped = withAmount(draft({ line: '2 pak koffie elke week' }), { quantity: 3 })
  expect(tapped.line).toBe('koffie elke week')
  expect(composedGrocery(tapped, TODAY)).toMatchObject({
    title: 'koffie',
    quantity: 3,
    repeat: WEEKLY_FRIDAY,
  })
})
