import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { RecipeThumbnail } from './RecipeThumbnail'

test('a photograph is the photograph', () => {
  const { container } = render(
    <RecipeThumbnail src="https://example.test/stamppot.jpg" />,
  )

  expect(container.querySelector('img')).toHaveAttribute(
    'src',
    'https://example.test/stamppot.jpg',
  )
  expect(screen.queryByText('🍲')).toBeNull()
})

test('no photograph, or a query that came back empty, is the recipe glyph', () => {
  const { rerender } = render(<RecipeThumbnail />)
  expect(screen.getByText('🍲')).toBeDefined()

  rerender(<RecipeThumbnail src={null} />)
  expect(screen.getByText('🍲')).toBeDefined()
})
