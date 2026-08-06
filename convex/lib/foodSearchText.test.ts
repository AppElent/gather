import { expect, test } from 'vitest'
import { foodSearchText } from './foodSearchText'

test('a food with a brand is searchable by either half', () => {
  expect(foodSearchText({ name: 'Halfvolle melk', brand: 'Campina' })).toBe(
    'Halfvolle melk Campina',
  )
})

test('a food with no brand is just its name', () => {
  expect(foodSearchText({ name: 'Flour, plain' })).toBe('Flour, plain')
})

test('a blank brand does not leave a trailing space behind', () => {
  expect(foodSearchText({ name: 'Rice', brand: '   ' })).toBe('Rice')
})

test('the words are stored as written — the index does the normalising', () => {
  expect(foodSearchText({ name: 'Crème Fraîche', brand: 'Zaanse Hoeve' })).toBe(
    'Crème Fraîche Zaanse Hoeve',
  )
})
