// @vitest-environment jsdom
import { act } from 'react'
import { expect, test } from 'vitest'
import { mount } from '../testing/dom'
import { useDebouncedText } from './use-debounced-text'

test('text a commit did not take stays, over a change from elsewhere, and is tried again', () => {
  let field = {} as ReturnType<typeof useDebouncedText>
  let take = false
  const seen: string[] = []
  function Probe({ value }: { value: string }) {
    field = useDebouncedText(value, (next) => {
      seen.push(next)
      return take
    })
    return null
  }
  const view = mount(<Probe value="saved" />)
  act(() => field.change('mine'))
  act(() => field.flush())
  view.rerender(<Probe value="theirs" />)
  expect(field.draft).toBe('mine')
  take = true
  act(() => field.flush())
  act(() => field.flush())
  expect(seen).toEqual(['mine', 'mine'])
  view.unmount()
})
