import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { RecipeCard } from './RecipeCard'

const recipe = {
  title: 'Sunday Roast',
  rating: 4,
  tags: ['dinner', 'comfort food'],
  imageUrl: 'https://example.com/photo.jpg',
}

test('grid mode shows title, stars, tags, and photo', () => {
  const { container } = render(<RecipeCard recipe={recipe} mode="grid" />)
  expect(screen.getByText('Sunday Roast')).toBeInTheDocument()
  expect(screen.getByText('★★★★')).toBeInTheDocument()
  expect(screen.getByText('dinner, comfort food')).toBeInTheDocument()
  expect(container.querySelector('img')).toHaveAttribute(
    'src',
    'https://example.com/photo.jpg',
  )
})

test('recipes without a photo render the recipe glyph, not a broken image', () => {
  render(<RecipeCard recipe={{ ...recipe, imageUrl: null }} mode="grid" />)
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
  expect(screen.getByText('🍲')).toBeInTheDocument()
})

test('compact mode renders the same content in a row layout', () => {
  const { container } = render(<RecipeCard recipe={recipe} mode="compact" />)
  expect(screen.getByText('Sunday Roast')).toBeInTheDocument()
  expect(container.querySelector('img')).toBeInTheDocument()
})

test('banner mode renders title and stars overlaid on the photo', () => {
  const { container } = render(<RecipeCard recipe={recipe} mode="banner" />)
  expect(screen.getByText('Sunday Roast')).toBeInTheDocument()
  expect(container.querySelector('img')).toBeInTheDocument()
})
