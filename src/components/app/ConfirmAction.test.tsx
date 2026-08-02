import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ConvexError } from 'convex/values'
import { describe, expect, test, vi } from 'vitest'
import { useConfirmAction } from './ConfirmAction'

/**
 * Asking before something irreversible, without `window.confirm`.
 *
 * This exists because of a bug that looked like a broken button: deleting a
 * task list did nothing at all. `window.confirm` is suppressed in an embedded
 * frame, so it returned `false` and the click quietly did nothing — and had it
 * got past that, the mutation behind it was fired as a bare `void` and would
 * have swallowed a refusal just as quietly. Both halves are tested here: the
 * question is the app's own, and the work is awaited with its failure shown.
 */

function Harness({ run }: { run: () => Promise<unknown> | unknown }) {
  const { confirm, dialog } = useConfirmAction()
  return (
    <div>
      <button
        type="button"
        onClick={() =>
          confirm({
            title: 'Delete the list “Groceries”?',
            body: 'Its tasks go with it.',
            confirmLabel: 'Delete list',
            errorFallback: 'Could not delete that list.',
            run,
          })
        }
      >
        Delete
      </button>
      {dialog}
    </div>
  )
}

describe('asking', () => {
  test('nothing runs until the question is answered', () => {
    const run = vi.fn()
    render(<Harness run={run} />)

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(screen.getByRole('dialog').textContent).toContain(
      'Delete the list “Groceries”?',
    )
    expect(run).not.toHaveBeenCalled()
  })

  test('cancelling closes the question and runs nothing', () => {
    const run = vi.fn()
    render(<Harness run={run} />)

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(run).not.toHaveBeenCalled()
  })

  test('Escape cancels too', () => {
    const run = vi.fn()
    render(<Harness run={run} />)

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(run).not.toHaveBeenCalled()
  })
})

describe('answering', () => {
  test('confirming runs the work and closes', async () => {
    const run = vi.fn().mockResolvedValue(undefined)
    render(<Harness run={run} />)

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete list' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(run).toHaveBeenCalledTimes(1)
  })

  test('a refusal is shown, and the question stays open', async () => {
    const run = vi.fn().mockRejectedValue(new ConvexError('List not found'))
    render(<Harness run={run} />)

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete list' }))

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'List not found',
    )
    expect(screen.getByRole('dialog')).toBeDefined()
  })

  test('a failure with nothing readable in it still says something', async () => {
    const run = vi.fn().mockRejectedValue({})
    render(<Harness run={run} />)

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete list' }))

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Could not delete that list.',
    )
  })
})
