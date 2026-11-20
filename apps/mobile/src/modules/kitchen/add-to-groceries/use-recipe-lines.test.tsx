// @vitest-environment jsdom
/**
 * A week with more unread lines than one AI call carries reads them all, in
 * batches, until the daily cap runs out (APP-423).
 */
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { mount, settle } from '../../../testing/dom'
import type { ReadAnswer } from './read-batches'
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
    await act(async () => release({ status: 'unavailable' }))
    expect(kinds(result, 'a')[40]).toBe('text')
  })
})
