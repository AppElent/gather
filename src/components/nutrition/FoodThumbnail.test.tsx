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

test('a photograph wins over an icon', () => {
  render(
    <FoodThumbnail
      src="https://example.test/nutella.jpg"
      icon="🍫"
      alt="Nutella"
    />,
  )

  expect(screen.getByAltText('Nutella')).toBeDefined()
  expect(screen.queryByText('🍫')).toBeNull()
  expect(screen.queryByText(GLYPH)).toBeNull()
})

test('a photograph and nothing else is the photograph', () => {
  render(<FoodThumbnail src="https://example.test/nutella.jpg" alt="Nutella" />)

  expect(screen.getByAltText('Nutella')).toBeDefined()
  expect(screen.queryByText(GLYPH)).toBeNull()
})

test('an icon stands in when there is no photograph', () => {
  render(<FoodThumbnail icon="🍫" alt="Nutella" />)

  expect(screen.getByText('🍫')).toBeDefined()
  expect(screen.queryByAltText('Nutella')).toBeNull()
  expect(screen.queryByText(GLYPH)).toBeNull()
})

test('neither leaves the generic glyph exactly where it was', () => {
  render(<FoodThumbnail alt="Nutella" />)

  expect(screen.getByText(GLYPH)).toBeDefined()
  expect(screen.queryByAltText('Nutella')).toBeNull()
})

/**
 * A query that resolved to no stored picture hands back `null`, not
 * `undefined` — the icon has to answer for that the same way.
 */
test('a food whose picture query came back empty still shows its icon', () => {
  render(<FoodThumbnail src={null} icon="🥛" alt="Milk" />)

  expect(screen.getByText('🥛')).toBeDefined()
})
