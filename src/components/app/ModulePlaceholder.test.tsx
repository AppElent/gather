import { screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { renderWithI18n } from '../../lib/i18n/testing'
import { ModulePlaceholder } from './ModulePlaceholder'

test('renders an operational placeholder page for a module', () => {
  renderWithI18n(<ModulePlaceholder moduleId="groceries" />)
  expect(screen.getByRole('heading', { name: 'Groceries' })).toBeDefined()
  expect(
    screen.getByText('A shared shopping list you both check off.'),
  ).toBeDefined()
  expect(screen.getByText('Module planned')).toBeDefined()
  expect(
    screen.getByText(/this module is listed in every group already/i),
  ).toBeDefined()
})

// The whole point of taking an id rather than three strings: the page names
// the Module in the reader's language without any caller having to know.
test('names the module in the reader’s language', () => {
  renderWithI18n(<ModulePlaceholder moduleId="groceries" />, { locale: 'nl' })
  expect(screen.getByRole('heading', { name: 'Boodschappen' })).toBeDefined()
  expect(screen.getByText('Module gepland')).toBeDefined()
})
