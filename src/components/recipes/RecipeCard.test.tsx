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
  render(<RecipeCard recipe={recipe} mode="grid" />)
  expect(screen.getByText('Sunday Roast')).toBeInTheDocument()
  expect(screen.getByText('★★★★')).toBeInTheDocument()
  expect(screen.getByText('dinner, comfort food')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'Sunday Roast' })).toBeInTheDocument()
})

test('recipes without a photo render a placeholder, not a broken image', () => {
  render(<RecipeCard recipe={{ ...recipe, imageUrl: null }} mode="grid" />)
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
})

test('compact mode renders the same content in a row layout', () => {
  render(<RecipeCard recipe={recipe} mode="compact" />)
  expect(screen.getByText('Sunday Roast')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'Sunday Roast' })).toBeInTheDocument()
})

test('banner mode renders title and stars overlaid on the photo', () => {
  render(<RecipeCard recipe={recipe} mode="banner" />)
  expect(screen.getByText('Sunday Roast')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'Sunday Roast' })).toBeInTheDocument()
})
