import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import type { Id } from '../../../convex/_generated/dataModel'
import { MultiEventForm } from './MultiEventForm'

const add = vi.fn()

vi.mock('convex/react', () => ({
  useMutation: () => add,
}))

const babyId = 'baby1' as Id<'babies'>

beforeEach(() => {
  add.mockReset()
  add.mockResolvedValue('event1')
  window.localStorage.clear()
})

function renderForm(onDone = vi.fn()) {
  return render(
    <MultiEventForm babyId={babyId} onDone={onDone} onCancel={vi.fn()} />,
  )
}

test('starts on the usual round — diaper, temperature and feeding', () => {
  renderForm()
  expect(screen.getByText('Kind')).toBeDefined()
  expect(screen.getByText('Temperature (°C)')).toBeDefined()
  expect(screen.getByText('Amount (ml)')).toBeDefined()
  expect(screen.getByRole('button', { name: 'Save 3 entries' })).toBeDefined()
})

test('saves one entry per checked type, all at the same timestamp', async () => {
  const onDone = vi.fn()
  renderForm(onDone)

  fireEvent.click(screen.getByRole('button', { name: 'Save 3 entries' }))

  await waitFor(() => expect(add).toHaveBeenCalledTimes(3))
  const calls = add.mock.calls.map(([args]) => args)
  expect(calls.map((c) => c.type)).toEqual(['temperature', 'feeding', 'diaper'])
  expect(new Set(calls.map((c) => c.timestamp)).size).toBe(1)
  expect(calls.every((c) => c.babyId === babyId)).toBe(true)
  await waitFor(() => expect(onDone).toHaveBeenCalled())
})

test('unchecking a type drops its block and its entry', async () => {
  renderForm()

  fireEvent.click(screen.getByRole('checkbox', { name: 'Diaper' }))
  expect(screen.queryByText('Kind')).toBeNull()

  fireEvent.click(screen.getByRole('button', { name: 'Save 2 entries' }))

  await waitFor(() => expect(add).toHaveBeenCalledTimes(2))
  expect(add.mock.calls.map(([args]) => args.type)).toEqual([
    'temperature',
    'feeding',
  ])
})

test('breast minutes become the feed duration', async () => {
  renderForm()

  fireEvent.change(screen.getByDisplayValue('Bottle'), {
    target: { value: 'breast' },
  })
  fireEvent.change(screen.getByLabelText('Left (min)'), {
    target: { value: '10' },
  })
  fireEvent.change(screen.getByLabelText('Right (min)'), {
    target: { value: '8' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save 3 entries' }))

  await waitFor(() => expect(add).toHaveBeenCalledTimes(3))
  const feed = add.mock.calls
    .map(([args]) => args)
    .find((c) => c.type === 'feeding')
  expect(feed.data).toMatchObject({
    method: 'breast',
    side: 'both',
    leftMin: 10,
    rightMin: 8,
  })
  expect(feed.endTimestamp).toBe(feed.timestamp + 18 * 60000)
})

test('a failed save keeps the unsaved entries on screen', async () => {
  add
    .mockResolvedValueOnce('event1')
    .mockRejectedValueOnce(new Error('Network down'))
  renderForm()

  fireEvent.click(screen.getByRole('button', { name: 'Save 3 entries' }))

  await waitFor(() =>
    expect(screen.getByText(/Saved 1 of 3 entries/)).toBeDefined(),
  )
  // Temperature saved, so only feeding and diaper are still pending.
  expect(screen.queryByText('Temperature (°C)')).toBeNull()
  expect(screen.getByRole('button', { name: 'Save 2 entries' })).toBeDefined()
})
