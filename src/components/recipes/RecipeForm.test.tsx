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
