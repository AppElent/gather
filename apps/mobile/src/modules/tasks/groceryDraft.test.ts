import { expect, test } from 'vitest'

import {
  addedSummary,
  amountSpans,
  composedGrocery,
  emptyGroceryDraft,
  type GroceryDraft,
  isGroceryDirty,
  nextGroceryDraft,
  quantityChoices,
  withAmount,
  withLine,
} from './groceryDraft'

const draft = (over: Partial<GroceryDraft> = {}): GroceryDraft => ({
  ...emptyGroceryDraft(),
  ...over,
})
const highlighted = (line: string) =>
  amountSpans(draft({ line })).map(({ start, end }) => line.slice(start, end))

test('the line fills the amount', () => {
  expect(composedGrocery(draft({ line: '2 pak melk' }))).toEqual({
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
  expect(composedGrocery(tapped)).toMatchObject({ title: 'melk', quantity: 3, unit: 'pak' })
  expect(amountSpans(tapped)).toEqual([])
  // Kept while the name goes on being typed, replaced by a newly typed amount.
  expect(composedGrocery(withLine(tapped, 'melk halfvol')).quantity).toBe(3)
  expect(composedGrocery(withLine(tapped, '6 melk'))).toMatchObject({
    title: 'melk',
    quantity: 6,
  })
})

test('a removed amount leaves the words as the name', () => {
  const removed = draft({ line: '6 eieren', amount: null })
  expect(composedGrocery(removed)).toEqual({ title: '6 eieren', staple: false })
  expect(amountSpans(removed)).toEqual([])
  expect(composedGrocery(withLine(removed, '6 eierenn')).title).toBe('6 eierenn')
})

test('an amount tapped before the name is typed stays with it', () => {
  const tapped = withAmount(draft(), { quantity: 2 })
  expect(composedGrocery(withLine(tapped, 'melk'))).toMatchObject({
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
