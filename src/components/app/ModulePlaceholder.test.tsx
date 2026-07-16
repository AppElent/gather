import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { ModulePlaceholder } from './ModulePlaceholder'

test('renders an operational placeholder page for a module', () => {
  render(
    <ModulePlaceholder
      label="Groceries"
      description="A shared shopping list you both check off."
      icon="ShoppingCart"
    />,
  )
  expect(screen.getByRole('heading', { name: 'Groceries' })).toBeDefined()
  expect(
    screen.getByText('A shared shopping list you both check off.'),
  ).toBeDefined()
  expect(screen.getByText('Module planned')).toBeDefined()
  expect(screen.getByText(/this group module is staged/i)).toBeDefined()
})
