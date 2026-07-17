import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { TaskRow } from './TaskRow'

const fullTask = {
  externalId: '1',
  title: 'Buy milk',
  done: false,
  dueDate: '2026-07-20',
  priority: 1 as const,
  labels: ['home'],
  url: 'https://todoist.com/showTask?id=1',
}

test('renders title, priority, labels, due date and link-out', () => {
  render(<TaskRow task={fullTask} />)
  expect(screen.getByText('Buy milk')).toBeInTheDocument()
  expect(screen.getByText('P1')).toBeInTheDocument()
  expect(screen.getByText('home')).toBeInTheDocument()
  expect(screen.getByText('2026-07-20')).toBeInTheDocument()
  expect(
    screen.getByRole('link', { name: /open buy milk/i }),
  ).toHaveAttribute('href', 'https://todoist.com/showTask?id=1')
  expect(screen.getByRole('checkbox')).toBeDisabled()
})

test('checkbox toggles when onToggle is provided', () => {
  const onToggle = vi.fn()
  render(
    <TaskRow
      task={{ externalId: '1', title: 'x', done: false }}
      onToggle={onToggle}
    />,
  )
  const checkbox = screen.getByRole('checkbox')
  expect(checkbox).toBeEnabled()
  fireEvent.click(checkbox)
  expect(onToggle).toHaveBeenCalledOnce()
})

test('done tasks render struck through', () => {
  render(<TaskRow task={{ externalId: '1', title: 'Old', done: true }} />)
  expect(screen.getByText('Old').className).toContain('line-through')
})
