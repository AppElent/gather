import { fireEvent, screen, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { renderWithI18n } from '../../lib/i18n/testing'
import { ComboActions } from './ComboActions'

/**
 * Renaming and deleting one saved Combo (#129). The card asks for the one
 * thing it needs and gets out of the way; deleting asks first, because there
 * is no undo.
 */

test('renaming starts from the name it already has', () => {
  renderWithI18n(
    <ComboActions
      name="Usual breakfast"
      onRename={vi.fn()}
      onDelete={vi.fn()}
    />,
  )

  // Both buttons name the combo they act on, so a screen reader hears which
  // one it is rather than a row of identical "Rename"s.
  expect(
    screen.getByRole('button', { name: 'New name for “Usual breakfast”' }),
  ).toBeDefined()
  expect(
    screen.getByRole('button', { name: 'Delete “Usual breakfast”' }),
  ).toBeDefined()

  fireEvent.click(screen.getByText('Rename'))
  // Editing a name is usually a correction, not a retype.
  expect(screen.getByDisplayValue('Usual breakfast')).toBeDefined()
})

test('a renamed combo is saved trimmed', async () => {
  const onRename = vi.fn().mockResolvedValue(undefined)
  renderWithI18n(
    <ComboActions
      name="Usual breakfast"
      onRename={onRename}
      onDelete={vi.fn()}
    />,
  )

  fireEvent.click(screen.getByText('Rename'))
  fireEvent.change(screen.getByDisplayValue('Usual breakfast'), {
    target: { value: '  Weekday breakfast  ' },
  })
  fireEvent.click(screen.getByText('Save'))

  await waitFor(() =>
    expect(onRename).toHaveBeenCalledWith('Weekday breakfast'),
  )
})

test('an empty name cannot be saved', () => {
  const onRename = vi.fn()
  renderWithI18n(
    <ComboActions
      name="Usual breakfast"
      onRename={onRename}
      onDelete={vi.fn()}
    />,
  )

  fireEvent.click(screen.getByText('Rename'))
  fireEvent.change(screen.getByDisplayValue('Usual breakfast'), {
    target: { value: '   ' },
  })
  fireEvent.click(screen.getByText('Save'))

  // Caught here rather than by the server, whose refusal would arrive in
  // English whatever the reader's language.
  expect(onRename).not.toHaveBeenCalled()
})

test('cancelling a rename keeps the old name', () => {
  const onRename = vi.fn()
  renderWithI18n(
    <ComboActions
      name="Usual breakfast"
      onRename={onRename}
      onDelete={vi.fn()}
    />,
  )

  fireEvent.click(screen.getByText('Rename'))
  fireEvent.change(screen.getByDisplayValue('Usual breakfast'), {
    target: { value: 'Something else' },
  })
  fireEvent.click(screen.getByText('Cancel'))

  expect(onRename).not.toHaveBeenCalled()
  fireEvent.click(screen.getByText('Rename'))
  expect(screen.getByDisplayValue('Usual breakfast')).toBeDefined()
})

test('deleting asks first, and says the diary is safe', () => {
  const onDelete = vi.fn()
  renderWithI18n(
    <ComboActions
      name="Usual breakfast"
      onRename={vi.fn()}
      onDelete={onDelete}
    />,
  )

  fireEvent.click(screen.getByText('Delete'))

  expect(screen.getByText('Delete “Usual breakfast”?')).toBeDefined()
  expect(
    screen.getByText('What you have already logged stays in your diary.'),
  ).toBeDefined()
  expect(onDelete).not.toHaveBeenCalled()
})

test('confirming deletes, cancelling does not', async () => {
  const onDelete = vi.fn().mockResolvedValue(undefined)
  renderWithI18n(
    <ComboActions
      name="Usual breakfast"
      onRename={vi.fn()}
      onDelete={onDelete}
    />,
  )

  fireEvent.click(screen.getByText('Delete'))
  fireEvent.click(screen.getByText('Cancel'))
  expect(onDelete).not.toHaveBeenCalled()

  fireEvent.click(screen.getByText('Delete'))
  // The confirmation's own Delete, which is the second one on screen.
  fireEvent.click(screen.getAllByText('Delete').at(-1) as HTMLElement)
  await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1))
})

test('a refusal is shown in the reader’s language, not the server’s', async () => {
  renderWithI18n(
    <ComboActions
      name="Usual breakfast"
      onRename={vi.fn().mockRejectedValue(new Error('Combo not found'))}
      onDelete={vi.fn()}
    />,
  )

  fireEvent.click(screen.getByText('Rename'))
  fireEvent.change(screen.getByDisplayValue('Usual breakfast'), {
    target: { value: 'Weekday breakfast' },
  })
  fireEvent.click(screen.getByText('Save'))

  await waitFor(() =>
    expect(screen.getByText('Could not rename this combo')).toBeDefined(),
  )
  expect(screen.queryByText('Combo not found')).toBeNull()
})
