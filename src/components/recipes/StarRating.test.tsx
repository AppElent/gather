import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { StarRating } from './StarRating'

test('clicking a star sets the rating', () => {
  const onChange = vi.fn()
  render(<StarRating value={undefined} onChange={onChange} />)
  fireEvent.click(screen.getByRole('radio', { name: '3 stars' }))
  expect(onChange).toHaveBeenCalledWith(3)
})

test('clicking the already-selected star clears the rating', () => {
  const onChange = vi.fn()
  render(<StarRating value={3} onChange={onChange} />)
  fireEvent.click(screen.getByRole('radio', { name: '3 stars' }))
  expect(onChange).toHaveBeenCalledWith(undefined)
})

test('only the star matching the current value is marked checked', () => {
  render(<StarRating value={3} onChange={() => {}} />)
  expect(screen.getByRole('radio', { name: '3 stars' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  expect(screen.getByRole('radio', { name: '4 stars' })).toHaveAttribute(
    'aria-checked',
    'false',
  )
})
