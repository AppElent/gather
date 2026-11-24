// @vitest-environment jsdom
/** A refused save keeps the typed text in the field to try again (APP-799). */
import { act } from 'react'
import { expect, test, vi } from 'vitest'

import { mount } from '../testing/dom'
import { useDebouncedText } from './use-debounced-text'

function field(value = 'Old') {
  const commit = vi.fn()
  let text = {} as ReturnType<typeof useDebouncedText>
  function Field({ value }: { value: string }) {
    text = useDebouncedText(value, commit, { onBlurOnly: true })
    return null
  }
  const view = mount(<Field value={value} />)
  return {
    commit,
    text: () => text,
    saved: (next: string) => view.rerender(<Field value={next} />),
    unmount: view.unmount,
    refuse: (typed: string) => {
      act(() => text.change(typed))
      act(() => text.blur())
      act(() => text.keep(typed))
    },
  }
}

test('a refused text stays and a blur sends it again', () => {
  const { commit, text, refuse, saved } = field()
  refuse('New')
  expect(text().draft).toBe('New')
  // A refresh that still has another title does not take it away.
  saved('Elsewhere')
  expect(text().draft).toBe('New')
  act(() => text().blur())
  expect(commit.mock.calls).toEqual([['New'], ['New']])
})

test('leaving does not send a refused text', () => {
  const { commit, refuse, unmount } = field()
  refuse('New')
  unmount()
  expect(commit).toHaveBeenCalledTimes(1)
})

test('typing on replaces it, and a refusal keeps what was typed since', () => {
  const { commit, text, refuse } = field()
  refuse('New')
  act(() => text().change('Newer'))
  act(() => text().keep('New'))
  expect(text().draft).toBe('Newer')
  act(() => text().blur())
  expect(commit).toHaveBeenLastCalledWith('Newer')
})

test('once the server holds it after all, later changes show again', () => {
  const { commit, text, refuse, saved } = field()
  refuse('New ')
  saved('New')
  expect(text().draft).toBe('New')
  act(() => text().blur())
  expect(commit).toHaveBeenCalledTimes(1)
  saved('From elsewhere')
  expect(text().draft).toBe('From elsewhere')
})
