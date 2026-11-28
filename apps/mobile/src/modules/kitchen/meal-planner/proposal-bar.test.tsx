// @vitest-environment jsdom
/**
 * The proposal bar's state (APP-319, APP-460). The round-1 regression: drafts
 * the query cache already holds on mount, or on a week change, must bring
 * the bar up in the first frame. Also: accepting the last draft never
 * flashes the bar off, an accept that resolves after a week change marks
 * nothing there, and only the slots the server planned say "net overgenomen".
 */
import { act, createElement } from 'react'
import { afterEach, describe, expect, test } from 'vitest'

import { mount } from '../../../testing/dom'
import { slotKey, toastClearance, useProposalBar } from './proposal-bar'

type Draft = { date: string; slot: 'dinner'; source: 'ai' | 'rules' | 'fallback' }
type Bar = ReturnType<typeof useProposalBar>

const frames: { week: string; showBar: boolean }[] = []
let bar: Bar | null = null

function Harness({ weekStart, drafts }: { weekStart: string; drafts: Draft[] }) {
  const state = useProposalBar(weekStart, drafts)
  bar = state
  frames.push({ week: weekStart, showBar: state.showBar })
  return state.showBar
    ? createElement(
        'div',
        { 'data-testid': 'proposal-bar', 'data-fallback': String(state.fallback) },
        [...state.justAccepted].join(','),
      )
    : null
}

const THIS_WEEK = '2026-11-16'
const NEXT_WEEK = '2026-11-23'
const tue: Draft = { date: '2026-11-24', slot: 'dinner', source: 'ai' }
const wed: Draft = { date: '2026-11-25', slot: 'dinner', source: 'rules' }

function render(weekStart: string, drafts: Draft[]) {
  return createElement(Harness, { weekStart, drafts })
}
function press() {
  let done: (planned: readonly string[]) => void = () => {}
  act(() => {
    done = (bar as Bar).startAccept()
  })
  return done
}
function resolve(done: (planned: readonly string[]) => void, planned: string[]) {
  act(() => done(planned))
}
const barIn = (container: HTMLElement) =>
  container.querySelector('[data-testid="proposal-bar"]')

afterEach(() => {
  frames.length = 0
  bar = null
  document.body.innerHTML = ''
})

describe('useProposalBar', () => {
  test('drafts cached on mount show the bar from the first frame', () => {
    const { container } = mount(render(NEXT_WEEK, [tue, wed]))
    expect(barIn(container)).not.toBeNull()
    expect(frames.every((frame) => frame.showBar)).toBe(true)
  })

  test('drafts cached for the week turned to show the bar, and stay up', () => {
    const view = mount(render(THIS_WEEK, []))
    expect(barIn(view.container)).toBeNull()
    frames.length = 0
    view.rerender(render(NEXT_WEEK, [tue, wed]))
    expect(barIn(view.container)).not.toBeNull()
    expect(frames.every((frame) => frame.showBar)).toBe(true)
  })

  test('accepting the last draft never flashes the bar off', () => {
    const view = mount(render(NEXT_WEEK, [tue]))
    // The press; then the query drops the draft before the mutation resolves.
    const done = press()
    frames.length = 0
    view.rerender(render(NEXT_WEEK, []))
    expect(frames.every((frame) => frame.showBar)).toBe(true)
    resolve(done, [slotKey(tue)])
    view.rerender(render(NEXT_WEEK, []))
    expect(barIn(view.container)?.textContent).toBe('2026-11-24|dinner')
  })

  test('an accept that planned nothing takes the tail back', () => {
    const view = mount(render(NEXT_WEEK, [tue]))
    const done = press()
    view.rerender(render(NEXT_WEEK, []))
    resolve(done, [])
    view.rerender(render(NEXT_WEEK, []))
    expect(barIn(view.container)).toBeNull()
  })

  test('an accept that resolves after a week change marks nothing on the new week', () => {
    const view = mount(render(NEXT_WEEK, [tue, wed]))
    const done = press()
    view.rerender(render(THIS_WEEK, []))
    resolve(done, [slotKey(tue), slotKey(wed)])
    view.rerender(render(THIS_WEEK, []))
    expect(barIn(view.container)).toBeNull()
  })

  test('accept all marks only the slots the server planned', () => {
    const view = mount(render(NEXT_WEEK, [tue, wed]))
    const done = press()
    view.rerender(render(NEXT_WEEK, []))
    resolve(done, [slotKey(wed)])
    view.rerender(render(NEXT_WEEK, []))
    expect(barIn(view.container)?.textContent).toBe('2026-11-25|dinner')
  })
  test('a week change from an all-saved week to an empty week hides the bar in its first frame', () => {
    const view = mount(render(NEXT_WEEK, [tue]))
    const done = press()
    view.rerender(render(NEXT_WEEK, []))
    resolve(done, [slotKey(tue)])
    view.rerender(render(NEXT_WEEK, []))
    expect(barIn(view.container)).not.toBeNull()
    frames.length = 0
    view.rerender(render(THIS_WEEK, []))
    expect(barIn(view.container)).toBeNull()
    expect(frames.length).toBeGreaterThan(0)
    expect(frames.every((frame) => !frame.showBar)).toBe(true)
  })

  test('coming back to the week does not bring its tail back', () => {
    const view = mount(render(NEXT_WEEK, [tue]))
    const done = press()
    view.rerender(render(NEXT_WEEK, []))
    resolve(done, [slotKey(tue)])
    view.rerender(render(THIS_WEEK, []))
    frames.length = 0
    view.rerender(render(NEXT_WEEK, []))
    expect(frames.every((frame) => !frame.showBar)).toBe(true)
  })
})

// APP-1002: on an iPhone SE the "nothing fits" toast covered the bar's buttons.
describe('toastClearance', () => {
  test('lifts the toast over the whole bar and its gap while the bar shows', () => {
    expect(toastClearance(true, 112, 12)).toBe(124)
  })

  test('leaves the toast at the bottom without the bar, or before it is measured', () => {
    expect(toastClearance(false, 112, 12)).toBe(0)
    expect(toastClearance(true, 0, 12)).toBe(0)
  })
})
