import { describe, expect, it } from 'vitest'
import { groceryAddFields } from './amount'
import { readGroceryRepeat } from './repeat'

// A Friday.
const TODAY = '2026-11-27'

describe('readGroceryRepeat', () => {
  it('reads "elke week" as every week on today’s weekday', () => {
    const read = readGroceryRepeat('koffie elke week', TODAY)
    expect(read.repeat).toEqual({
      mode: 'fixed',
      unit: 'week',
      every: 1,
      weekdays: [5],
    })
    expect(read.part?.text).toBe('elke week')
    expect(read.rest.trim()).toBe('koffie')
    expect(read.rest).toHaveLength('koffie elke week'.length)
  })

  it('reads the task composer’s other phrases', () => {
    expect(readGroceryRepeat('melk every 2 weeks', TODAY).repeat).toMatchObject({
      unit: 'week',
      every: 2,
    })
    expect(readGroceryRepeat('brood elke dinsdag', TODAY).repeat).toMatchObject({
      unit: 'week',
      weekdays: [2],
    })
    expect(readGroceryRepeat('wc-papier maandelijks', TODAY).repeat).toEqual({
      mode: 'fixed',
      unit: 'month',
      every: 1,
      monthDay: 27,
    })
    expect(readGroceryRepeat('eieren om de week', TODAY).repeat).toMatchObject({
      unit: 'week',
      every: 2,
    })
  })

  it('reads only the repeat: a date or a time stays part of the name', () => {
    const read = readGroceryRepeat('taart morgen om 9', TODAY)
    expect(read.repeat).toBeUndefined()
    expect(read.rest).toBe('taart morgen om 9')
  })

  it('leaves a dismissed repeat in the name', () => {
    const read = readGroceryRepeat('koffie elke week', TODAY, ['repeat:elke week'])
    expect(read.repeat).toBeUndefined()
    expect(read.rest).toBe('koffie elke week')
  })

  it('does not read a word that only starts like one', () => {
    expect(readGroceryRepeat('dagelijkse vitamines', TODAY).repeat).toBeUndefined()
  })

  it('keeps the amount readable once the repeat is out', () => {
    const read = readGroceryRepeat('2 pak koffie elke 2 weken', TODAY)
    expect(read.repeat).toMatchObject({ unit: 'week', every: 2 })
    expect(groceryAddFields(read.rest)).toEqual({
      title: 'koffie',
      quantity: 2,
      unit: 'pak',
    })
  })
})
