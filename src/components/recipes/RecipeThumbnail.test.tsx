import { render } from '@testing-library/react'
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
  expect(container.querySelector('[data-tile]')).toBeNull()
})

test('no photograph, or a query that came back empty, is the Kitchen tile, never a placeholder picture', () => {
  const { container, rerender } = render(<RecipeThumbnail />)
  const tile = () => container.querySelector('[data-tile]')
  expect(tile()).toHaveAttribute('data-group', 'kitchen')
  expect(container.querySelector('img')).toBeNull()

  rerender(<RecipeThumbnail src={null} />)
  expect(tile()).toHaveAttribute('data-group', 'kitchen')
})
