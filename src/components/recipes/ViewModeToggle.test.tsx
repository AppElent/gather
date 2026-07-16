import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { ViewModeToggle } from './ViewModeToggle'

test('clicking an option calls onChange with that mode', () => {
  const onChange = vi.fn()
  render(<ViewModeToggle mode="grid" onChange={onChange} />)
  fireEvent.click(screen.getByRole('radio', { name: 'Compact view' }))
  expect(onChange).toHaveBeenCalledWith('compact')
})

test('the active mode is marked checked', () => {
  render(<ViewModeToggle mode="banner" onChange={() => {}} />)
  expect(screen.getByRole('radio', { name: 'Banner view' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  expect(screen.getByRole('radio', { name: 'Grid view' })).toHaveAttribute(
    'aria-checked',
    'false',
  )
})
