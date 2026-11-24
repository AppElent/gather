// @vitest-environment jsdom
/**
 * A week with more unread lines than one AI call carries reads them all, in
 * batches, until the daily cap runs out (APP-423).
 */

import type { ReadAnswer } from '@gather/core/grocery-ai-batches'
import { pickRows } from '@gather/core/grocery-pick'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { mount, settle } from '../../../testing/dom'
import { type IngredientSource, useIngredientLines } from './use-recipe-lines'

const server = vi.hoisted(() => ({
  read: undefined as unknown as (args: { lines: string[] }) => Promise<unknown>,
}))

vi.mock('convex/react', () => ({ useAction: () => server.read }))
vi.mock('../../../convex/api', () => ({
  api: { groceryLines: { read: 'groceryLines.read' } },
}))
vi.mock('./line-cache', () => ({
  readCachedLines: () => ({}),
  cacheLines: () => undefined,
}))

// Lines the local parser cannot read: no amount, no known shape.
const unreadable = (count: number, from = 0) =>
  Array.from({ length: count }, (_, index) => `Kruiden-mix nummer ${from + index}?!`)

function renderLines(recipes: IngredientSource[]) {
  const result = { current: undefined as unknown as ReturnType<typeof useIngredientLines> }
  function Probe() {
    result.current = useIngredientLines(recipes)
    return null
  }
  mount(<Probe />)
  return result
}

const kinds = (result: { current: ReturnType<typeof useIngredientLines> }, id: string) =>
  (result.current.lines.get(id) ?? []).map((line) => line.read.kind)

beforeEach(() => {
  server.read = async ({ lines }) =>
    ({
      status: 'read',
      used: 1,
      limit: 30,
      lines: lines.map((line) => ({ name: line.slice(0, 20) })),
    }) satisfies ReadAnswer
})
afterEach(() => {
  document.body.innerHTML = ''
})

describe('useIngredientLines', () => {
  test('45 unread lines over two recipes are all read, in two calls', async () => {
    const calls: number[] = []
    server.read = async ({ lines }) => {
      calls.push(lines.length)
      return {
        status: 'read',
        used: calls.length,
        limit: 30,
        lines: lines.map((line) => ({ name: line.slice(0, 20) })),
      }
    }
    const recipes = [
      { id: 'a', ingredients: unreadable(25) },
      { id: 'b', ingredients: unreadable(20, 25) },
    ]
    const result = renderLines(recipes)
    // Nothing answered yet: every line is being read.
    expect(kinds(result, 'a').every((kind) => kind === 'reading')).toBe(true)
    await settle()
    expect(calls).toEqual([40, 5])
    expect([...kinds(result, 'a'), ...kinds(result, 'b')].every((kind) => kind === 'read')).toBe(true)
    expect(result.current.aiCount).toEqual({ used: 2, limit: 30 })
  })

  test('the cap running out mid-week leaves the rest as plain text', async () => {
    const calls: number[] = []
    server.read = async ({ lines }) => {
      calls.push(lines.length)
      return calls.length === 1
        ? { status: 'read', used: 30, limit: 30, lines: lines.map((line) => ({ name: line.slice(0, 20) })) }
        : { status: 'limit', limit: 30 }
    }
    const result = renderLines([{ id: 'a', ingredients: unreadable(45) }])
    await settle()
    expect(calls).toEqual([40, 5])
    expect(kinds(result, 'a')).toEqual([...Array(40).fill('read'), ...Array(5).fill('text')])
  })

  test('while the second batch is out, its lines are still being read', async () => {
    let release: (answer: unknown) => void = () => undefined
    let call = 0
    server.read = ({ lines }) => {
      call++
      if (call === 2) return new Promise((resolve) => { release = resolve })
      return Promise.resolve({
        status: 'read',
        used: 1,
        limit: 30,
        lines: lines.map((line) => ({ name: line.slice(0, 20) })),
      })
    }
    const result = renderLines([{ id: 'a', ingredients: unreadable(41) }])
    await settle()
    expect(kinds(result, 'a')).toEqual([...Array(40).fill('read'), 'reading'])
    // The count shows as soon as the first batch has answered (APP-479).
    expect(result.current.aiCount).toEqual({ used: 1, limit: 30 })
    await act(async () => release({ status: 'unavailable' }))
    expect(kinds(result, 'a')[40]).toBe('text')
  })

  test('a batch still out when the lines change is kept and not asked for again (APP-479)', async () => {
    const calls: string[][] = []
    let release: () => void = () => undefined
    const answerFor = (lines: string[]) => ({
      status: 'read' as const,
      used: calls.length,
      limit: 30,
      lines: lines.map((line) => ({ name: line.slice(0, 20) })),
    })
    server.read = ({ lines }) => {
      calls.push(lines)
      if (calls.length === 1)
        return new Promise((resolve) => {
          release = () => resolve(answerFor(lines))
        })
      return Promise.resolve(answerFor(lines))
    }
    const result = { current: undefined as unknown as ReturnType<typeof useIngredientLines> }
    function Probe({ recipes }: { recipes: IngredientSource[] }) {
      result.current = useIngredientLines(recipes)
      return null
    }
    const ingredients = unreadable(45)
    const view = mount(<Probe recipes={[{ id: 'a', ingredients }]} />)
    await settle()
    expect(calls).toHaveLength(1)
    // The recipes come back as new objects: the reading effect runs again
    // while the first call is out. It waits for that call, it does not repeat it.
    view.rerender(<Probe recipes={[{ id: 'a', ingredients }]} />)
    await settle()
    expect(calls).toHaveLength(1)
    await act(async () => release())
    await settle()
    expect(calls.map((lines) => lines.length)).toEqual([40, 5])
    expect(calls[1]).toEqual(ingredients.slice(40))
    expect(kinds(result, 'a').every((kind) => kind === 'read')).toBe(true)
  })

  test('the count shows while later batches are out, before every line is read (APP-479)', async () => {
    let call = 0
    server.read = ({ lines }) => {
      call++
      if (call === 2) return new Promise(() => undefined)
      return Promise.resolve({
        status: 'read',
        used: 7,
        limit: 30,
        lines: lines.map((line) => ({ name: line.slice(0, 20) })),
      })
    }
    const result = renderLines([{ id: 'a', ingredients: unreadable(90) }])
    expect(result.current.aiCount).toBeNull()
    await settle()
    expect(result.current.aiCount).toEqual({ used: 7, limit: 30 })
    expect(kinds(result, 'a').filter((kind) => kind === 'reading')).toHaveLength(50)
  })

  test('a line added after a reading waits for its own, not as text (APP-590)', async () => {
    let call = 0
    server.read = ({ lines }) => {
      call++
      if (call === 2) return new Promise(() => undefined)
      return Promise.resolve({
        status: 'read',
        used: 1,
        limit: 30,
        lines: lines.map((line) => ({ name: line.slice(0, 20) })),
      })
    }
    const result = { current: undefined as unknown as ReturnType<typeof useIngredientLines> }
    function Probe({ recipes }: { recipes: IngredientSource[] }) {
      result.current = useIngredientLines(recipes)
      return null
    }
    const view = mount(<Probe recipes={[{ id: 'a', ingredients: unreadable(3) }]} />)
    expect(result.current.readingAsText).toBe(false)
    await settle()
    expect(result.current.aiCount).toEqual({ used: 1, limit: 30 })
    // A new line: the count carries over, but the new line's reading has not
    // answered yet, so it may not go on as text.
    view.rerender(<Probe recipes={[{ id: 'a', ingredients: unreadable(4) }]} />)
    await settle()
    expect(kinds(result, 'a')).toEqual(['read', 'read', 'read', 'reading'])
    expect(result.current.aiCount).toEqual({ used: 1, limit: 30 })
    expect(result.current.readingAsText).toBe(false)
  })

  test('a week still being read lets the rest go as text once a batch answered', async () => {
    let call = 0
    server.read = ({ lines }) => {
      call++
      if (call === 2) return new Promise(() => undefined)
      return Promise.resolve({
        status: 'read',
        used: 1,
        limit: 30,
        lines: lines.map((line) => ({ name: line.slice(0, 20) })),
      })
    }
    const result = renderLines([{ id: 'a', ingredients: unreadable(41) }])
    await settle()
    expect(result.current.readingAsText).toBe(true)
  })

  test('over the cap, a later run does not ask again (APP-590)', async () => {
    const calls: string[][] = []
    server.read = async ({ lines }) => {
      calls.push(lines)
      return { status: 'limit', limit: 30 }
    }
    const result = { current: undefined as unknown as ReturnType<typeof useIngredientLines> }
    function Probe({ recipes }: { recipes: IngredientSource[] }) {
      result.current = useIngredientLines(recipes)
      return null
    }
    const view = mount(<Probe recipes={[{ id: 'a', ingredients: unreadable(3), servings: 2 }]} />)
    await settle()
    expect(calls).toHaveLength(1)
    expect(kinds(result, 'a')).toEqual(['text', 'text', 'text'])
    // A servings change, then another line: neither asks over the cap.
    view.rerender(<Probe recipes={[{ id: 'a', ingredients: unreadable(3), servings: 4 }]} />)
    await settle()
    view.rerender(<Probe recipes={[{ id: 'a', ingredients: unreadable(4), servings: 4 }]} />)
    await settle()
    expect(calls).toHaveLength(1)
    expect(kinds(result, 'a')).toEqual(['text', 'text', 'text', 'text'])
  })

  test('a tick and a retyped line stay on their ingredient when the recipe is reordered (APP-734)', () => {
    const edited = { kind: 'read', via: 'edited', name: 'Rode uien', quantity: 3 } as const
    const linesOf = (ingredients: string[]) => {
      const result = renderLines([{ id: 'a', ingredients }])
      return result.current.lines.get('a') ?? []
    }
    const before = linesOf(['2 uien', '1 knoflook', '3 tomaten'])
    const ui = before[0].key
    const knoflook = before[1].key
    const ticks = { [ui]: false }
    const edits = { [knoflook]: edited }

    const after = linesOf(['3 tomaten', '1 knoflook', '2 uien'])
    const keyOf = (text: string) => after.find((line) => line.text === text)?.key
    expect(keyOf('2 uien')).toBe(ui)
    expect(keyOf('1 knoflook')).toBe(knoflook)

    // The unticked onion is still the onion; the others keep their defaults.
    const rows = pickRows({ lines: after, items: [], ticks }).rows
    expect(rows.map((row) => [row.title, row.on])).toEqual([
      ['Tomaten', true],
      ['Knoflook', true],
      ['Uien', false],
    ])
    expect(after.filter((line) => edits[line.key]).map((line) => line.text)).toEqual([
      '1 knoflook',
    ])

    // An ingredient that is gone takes its tick with it: nothing lands on
    // whatever now stands where it was.
    const gone = linesOf(['3 tomaten', '1 knoflook'])
    expect(gone.some((line) => line.key in ticks)).toBe(false)
  })

  test('a repeated ingredient keeps one key per copy', () => {
    const result = renderLines([{ id: 'a', ingredients: ['zout', 'peper', 'zout', ''] }])
    const keys = (result.current.lines.get('a') ?? []).map((line) => line.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys).toEqual(['zout', 'peper', 'zout#1'])
  })
})
