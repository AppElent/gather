import { describe, expect, test } from 'vitest'

import { headingCase } from './calendarLabels'

const day = new Date('2026-11-18T12:00:00')

describe('headingCase', () => {
  test('Dutch capitalises only the first word', () => {
    const label = day.toLocaleDateString('nl', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
    expect(headingCase(label, 'nl')).toBe('Woensdag 18 november')
  })

  test('Dutch month and year heading keeps the year', () => {
    const label = day.toLocaleDateString('nl', {
      month: 'long',
      year: 'numeric',
    })
    expect(headingCase(label, 'nl')).toBe('November 2026')
  })

  test('English is unchanged', () => {
    const label = day.toLocaleDateString('en', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
    expect(headingCase(label, 'en')).toBe(label)
  })
})
