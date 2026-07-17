import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { RecipeForm } from './RecipeForm'

test('submits title and newline-split ingredients/steps', () => {
  const onSubmit = vi.fn()
  render(<RecipeForm onSubmit={onSubmit} submitting={false} />)

  fireEvent.change(screen.getByLabelText('Title'), {
    target: { value: 'Pasta' },
  })
  fireEvent.change(screen.getByLabelText('Ingredients'), {
    target: { value: 'pasta\nsalt' },
  })
  fireEvent.change(screen.getByLabelText('Steps'), {
    target: { value: 'boil\nserve' },
  })
  fireEvent.click(screen.getByRole('button', { name: /save/i }))

  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      title: 'Pasta',
      ingredients: ['pasta', 'salt'],
      steps: ['boil', 'serve'],
      tags: [],
    }),
  )
})

test('star rating can be set and submitted', () => {
  const onSubmit = vi.fn()
  render(<RecipeForm onSubmit={onSubmit} submitting={false} />)

  fireEvent.change(screen.getByLabelText('Title'), {
    target: { value: 'Pasta' },
  })
  fireEvent.click(screen.getByRole('radio', { name: '4 stars' }))
  fireEvent.click(screen.getByRole('button', { name: /save/i }))

  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ rating: 4 }))
})

test('submits typed nutrition as manual source', () => {
  const onSubmit = vi.fn()
  render(<RecipeForm onSubmit={onSubmit} submitting={false} />)

  fireEvent.change(screen.getByLabelText('Title'), {
    target: { value: 'Pasta' },
  })
  fireEvent.change(screen.getByLabelText('Servings'), {
    target: { value: '4' },
  })
  fireEvent.change(screen.getByLabelText('Calories (kcal)'), {
    target: { value: '520' },
  })
  fireEvent.change(screen.getByLabelText('Protein (g)'), {
    target: { value: '12,5' },
  })
  fireEvent.click(screen.getByRole('button', { name: /save/i }))

  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      servings: 4,
      nutrition: { calories: 520, protein: 12.5 },
      nutritionSource: 'manual',
    }),
  )
})

test('omits nutrition when all nutrient fields are empty', () => {
  const onSubmit = vi.fn()
  render(<RecipeForm onSubmit={onSubmit} submitting={false} />)

  fireEvent.change(screen.getByLabelText('Title'), {
    target: { value: 'Pasta' },
  })
  fireEvent.click(screen.getByRole('button', { name: /save/i }))

  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      nutrition: undefined,
      nutritionSource: undefined,
    }),
  )
})

test('keeps the imported source when prefilled nutrition is untouched', () => {
  const onSubmit = vi.fn()
  render(
    <RecipeForm
      onSubmit={onSubmit}
      submitting={false}
      initial={{
        title: 'Soep',
        ingredients: ['water'],
        steps: ['kook'],
        tags: [],
        nutrition: { calories: 300 },
        nutritionSource: 'imported',
      }}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: /save/i }))
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      nutrition: { calories: 300 },
      nutritionSource: 'imported',
    }),
  )
})

test('estimate button fills nutrition and submits ai source', async () => {
  const onSubmit = vi.fn()
  const onEstimate = vi.fn().mockResolvedValue({ calories: 300, fat: 10 })
  render(
    <RecipeForm
      onSubmit={onSubmit}
      submitting={false}
      onEstimate={onEstimate}
    />,
  )

  fireEvent.change(screen.getByLabelText('Title'), {
    target: { value: 'Soep' },
  })
  fireEvent.change(screen.getByLabelText('Ingredients'), {
    target: { value: 'water\nwortel' },
  })
  fireEvent.click(screen.getByRole('button', { name: /estimate with ai/i }))
  await screen.findByDisplayValue('300')

  expect(onEstimate).toHaveBeenCalledWith({
    ingredients: ['water', 'wortel'],
    servings: undefined,
  })
  fireEvent.click(screen.getByRole('button', { name: /save/i }))
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      nutrition: { calories: 300, fat: 10 },
      nutritionSource: 'ai',
    }),
  )
})

test('hides the estimate button when onEstimate is not provided', () => {
  render(<RecipeForm onSubmit={vi.fn()} submitting={false} />)
  expect(screen.queryByRole('button', { name: /estimate/i })).toBeNull()
})
