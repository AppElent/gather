import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { FoodThumbnail } from './FoodThumbnail'

/**
 * The tile's fallback chain, all four ways round (#94).
 *
 * Pure display logic with nothing behind it — no query, no locale, no router —
 * so it is tested here rather than through the add sheet, where it would be
 * one assertion inside a component that has to be mocked into existence first.
 *
 * The case worth writing down is the first: a food may have both a photograph
 * and an icon, and which of the two wins is a decision, not an accident.
 */

const GLYPH = '🍽'

test.each([
  ['food', '🍽'],
  ['recipe', '🍲'],
  ['combo', '🍱'],
] as const)('%s uses its own generic glyph', (kind, glyph) => {
  render(<FoodThumbnail kind={kind} />)

  expect(screen.getByText(glyph)).toBeDefined()
})

test('a photograph wins over an icon', () => {
  const { container } = render(
    <FoodThumbnail src="https://example.test/nutella.jpg" icon="🍫" />,
  )

  expect(container.querySelector('img')).toHaveAttribute(
    'src',
    'https://example.test/nutella.jpg',
  )
  expect(screen.queryByText('🍫')).toBeNull()
  expect(screen.queryByText(GLYPH)).toBeNull()
})

test('a photograph and nothing else is the photograph', () => {
  const { container } = render(
    <FoodThumbnail src="https://example.test/nutella.jpg" />,
  )

  expect(container.querySelector('img')).toBeDefined()
  expect(screen.queryByText(GLYPH)).toBeNull()
})

test('an icon stands in when there is no photograph', () => {
  render(<FoodThumbnail icon="🍫" />)

  expect(screen.getByText('🍫')).toBeDefined()
  expect(screen.queryByText(GLYPH)).toBeNull()
})

test('neither leaves the generic glyph exactly where it was', () => {
  render(<FoodThumbnail />)

  expect(screen.getByText(GLYPH)).toBeDefined()
})

/**
 * A query that resolved to no stored picture hands back `null`, not
 * `undefined` — the icon has to answer for that the same way.
 */
test('a food whose picture query came back empty still shows its icon', () => {
  render(<FoodThumbnail src={null} icon="🥛" />)

  expect(screen.getByText('🥛')).toBeDefined()
})
