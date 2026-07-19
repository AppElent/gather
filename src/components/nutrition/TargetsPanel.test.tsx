import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { TargetsPanel } from './TargetsPanel'

test('starts collapsed and expands to show the nutrient grid', () => {
  render(<TargetsPanel saving={false} onSave={vi.fn()} />)
  expect(screen.queryByText('Calories (kcal)')).toBeNull()
  fireEvent.click(screen.getByText('Daily targets'))
  expect(screen.getByText('Calories (kcal)')).toBeDefined()
})

test('prefills from targets and calls onSave with parsed values', () => {
  const onSave = vi.fn()
  render(
    <TargetsPanel
      targets={{ calories: 2000 }}
      saving={false}
      onSave={onSave}
    />,
  )
  fireEvent.click(screen.getByText('Daily targets'))
  expect(screen.getByLabelText('Calories (kcal)')).toHaveValue('2000')
  fireEvent.change(screen.getByLabelText('Protein (g)'), {
    target: { value: '120' },
  })
  fireEvent.click(screen.getByRole('button', { name: /save targets/i }))
  expect(onSave).toHaveBeenCalledWith({ calories: 2000, protein: 120 })
})

test('syncs the form when targets arrives after mount (e.g. the parent query was still loading)', () => {
  const { rerender } = render(<TargetsPanel saving={false} onSave={vi.fn()} />)
  fireEvent.click(screen.getByText('Daily targets'))
  expect(screen.getByLabelText('Calories (kcal)')).toHaveValue('')
  rerender(
    <TargetsPanel
      targets={{ calories: 1800 }}
      saving={false}
      onSave={vi.fn()}
    />,
  )
  expect(screen.getByLabelText('Calories (kcal)')).toHaveValue('1800')
})
