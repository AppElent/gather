// @vitest-environment jsdom
/**
 * `useAisleOf` (APP-423, APP-479): the aisle the list would give a title, with
 * the phone's own recogniser until the answer is in, and earlier answers kept
 * while a new question is out.
 */
import type { GroceryAisle } from '@gather/core/groceries'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { mount } from '../../../testing/dom'
import { useAisleOf } from './use-aisles'

const server = vi.hoisted(() => ({
  /** What the query answers for the titles asked; undefined while loading. */
  answer: undefined as unknown as (
    titles: string[],
  ) => GroceryAisle[] | Error | undefined,
  /** The same answer object for the same question, as Convex returns it. */
  answers: new Map<string, unknown>(),
  asked: [] as unknown[],
}))

/** Change what the server answers; the next render gets a new answer. */
function answerWith(
  answer: (titles: string[]) => GroceryAisle[] | Error | undefined,
) {
  server.answer = answer
  server.answers = new Map()
}

vi.mock('../../../convex/api', () => ({
  api: { groceryLines: { aisles: 'groceryLines.aisles' } },
}))
vi.mock('../../../convex/queries', () => ({
  // One request, `aisles`, or none while skipped; a failed question comes
  // back as its Error, as Convex's `useQueries` hands it over.
  useLiveQueries: (requests: Record<string, { args: unknown }>) => {
    const args = requests.aisles?.args ?? 'skip'
    server.asked.push(args)
    if (args === 'skip') return {}
    const key = JSON.stringify(args)
    if (!server.answers.has(key))
      server.answers.set(key, server.answer((args as { titles: string[] }).titles))
    return { aisles: server.answers.get(key) }
  },
}))

interface Props {
  listId: string | undefined
  titles: string[]
}

function render(initial: Props) {
  const result = { current: undefined as unknown as ReturnType<typeof useAisleOf> }
  function Probe(props: Props) {
    result.current = useAisleOf('jansen', props.listId, props.titles)
    return null
  }
  const view = mount(<Probe {...initial} />)
  return { result, rerender: (next: Props) => view.rerender(<Probe {...next} />) }
}

// The dictionary files eggs under dairy and an onion under produce; nothing
// knows the third name.
const EGGS = 'Eieren'
const ONION = 'Ui'
const UNKNOWN = 'Zzqxv'

beforeEach(() => {
  server.asked = []
  answerWith(() => undefined)
})
afterEach(() => {
  document.body.innerHTML = ''
})

describe('useAisleOf', () => {
  test('answers with the phone’s own recogniser until the server has answered', () => {
    const { result } = render({ listId: 'list-1', titles: [EGGS, UNKNOWN] })
    expect(result.current(EGGS)).toBe('dairy')
    expect(result.current(UNKNOWN)).toBe('other')
  })

  test('asks once for the distinct titles, sorted, and uses the answer over the fallback', () => {
    // The Group files eggs under snacks.
    answerWith((titles) => titles.map((title) => (title === EGGS ? 'snacks' : 'other')))
    const { result } = render({ listId: 'list-1', titles: [UNKNOWN, EGGS, UNKNOWN] })
    expect(server.asked[0]).toEqual({
      groupSlug: 'jansen',
      listId: 'list-1',
      titles: [EGGS, UNKNOWN],
    })
    expect(result.current(EGGS)).toBe('snacks')
    expect(result.current(UNKNOWN)).toBe('other')
  })

  test('keeps what an earlier answer said while a new question is out', () => {
    answerWith((titles) => titles.map((title) => (title === EGGS ? 'snacks' : 'other')))
    const { result, rerender } = render({ listId: 'list-1', titles: [EGGS] })
    expect(result.current(EGGS)).toBe('snacks')
    // A new title joins and the answer for the new question is not in yet.
    answerWith(() => undefined)
    rerender({ listId: 'list-1', titles: [EGGS, ONION] })
    expect(result.current(EGGS)).toBe('snacks')
    expect(result.current(ONION)).toBe('produce')
    // The answer arrives: the new title follows it, the old one still stands.
    answerWith((titles) => titles.map(() => 'snacks' as const))
    rerender({ listId: 'list-1', titles: [EGGS, ONION] })
    expect(result.current(ONION)).toBe('snacks')
    expect(result.current(EGGS)).toBe('snacks')
  })

  test('another list starts over: the first list’s answers are not carried across', () => {
    answerWith((titles) => titles.map(() => 'snacks' as const))
    const { result, rerender } = render({ listId: 'list-1', titles: [EGGS] })
    expect(result.current(EGGS)).toBe('snacks')
    answerWith(() => undefined)
    rerender({ listId: 'list-2', titles: [EGGS] })
    expect(result.current(EGGS)).toBe('dairy')
  })

  test('without a list nothing is asked and the phone answers', () => {
    const { result } = render({ listId: undefined, titles: [EGGS] })
    expect(server.asked.every((args) => args === 'skip')).toBe(true)
    expect(result.current(EGGS)).toBe('dairy')
  })

  test('a failed question is answered by the phone instead of throwing (APP-536)', () => {
    answerWith(() => new Error('This is not a grocery list'))
    const { result } = render({ listId: 'list-1', titles: [EGGS, UNKNOWN] })
    expect(result.current(EGGS)).toBe('dairy')
    expect(result.current(UNKNOWN)).toBe('other')
  })

  test('a failed question keeps what an earlier answer said', () => {
    answerWith((titles) => titles.map(() => 'snacks' as const))
    const { result, rerender } = render({ listId: 'list-1', titles: [EGGS] })
    answerWith(() => new Error('offline'))
    rerender({ listId: 'list-1', titles: [EGGS, ONION] })
    expect(result.current(EGGS)).toBe('snacks')
    expect(result.current(ONION)).toBe('produce')
  })

  test('without titles nothing is asked', () => {
    render({ listId: 'list-1', titles: [] })
    expect(server.asked.every((args) => args === 'skip')).toBe(true)
  })
})
