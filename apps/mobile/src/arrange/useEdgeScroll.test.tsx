// @vitest-environment jsdom
/**
 * The edge-scroll loop (APP-534) against a fake scroll view: an 800-tall
 * view at the top of the window, a 100-point see-through header over it and
 * a 34-point home bar under it, resting where iOS puts it, at -100. Frames
 * run by hand.
 */
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { mount } from '../testing/dom'
import { EDGE_MAX_STEP, useEdgeScroll } from './edgeScroll'

let frames: (() => void)[] = []
const runFrame = () => {
  const due = frames
  frames = []
  for (const frame of due) frame()
}

beforeEach(() => {
  frames = []
  vi.stubGlobal('requestAnimationFrame', (fn: () => void) => {
    frames.push(fn)
    return frames.length
  })
  vi.stubGlobal('cancelAnimationFrame', () => {
    frames = []
  })
})
afterEach(() => vi.unstubAllGlobals())

function setup(offset = -100) {
  const scrolledTo: number[] = []
  const view = {
    scrollTo: ({ y }: { y: number }) => scrolledTo.push(y),
    measureInWindow: (cb: (...args: number[]) => void) => cb(0, 0, 390, 800),
  }
  // The content's top sits `offset` above the view's top.
  const probe = {
    measureInWindow: (cb: (...args: number[]) => void) => cb(0, -offset),
  }
  let hook: ReturnType<typeof useEdgeScroll> | undefined
  function Harness() {
    hook = useEdgeScroll({ current: view }, { top: 100, bottom: 34 })
    ;(hook.probeRef as { current: unknown }).current = probe
    return null
  }
  const mounted = mount(<Harness />)
  const edge = hook as ReturnType<typeof useEdgeScroll>
  edge.scrollProps.onContentSizeChange(390, 2000)
  edge.scrollProps.onLayout({
    nativeEvent: { layout: { height: 800 } },
  } as never)
  return { edge, scrolledTo, mounted }
}

test('held at the bottom edge, the list scrolls down and the drag hears how far', () => {
  const { edge, scrolledTo, mounted } = setup()
  const totals: number[] = []
  edge.edgeScroll.begin((total) => totals.push(total))
  edge.edgeScroll.follow(790)
  runFrame()
  runFrame()
  expect(scrolledTo).toEqual([-100 + EDGE_MAX_STEP, -100 + 2 * EDGE_MAX_STEP])
  expect(totals).toEqual([EDGE_MAX_STEP, 2 * EDGE_MAX_STEP])

  // Dropped: no frame scrolls it further.
  edge.edgeScroll.end()
  runFrame()
  expect(scrolledTo).toHaveLength(2)
  mounted.unmount()
})

test('at rest under the header, the top edge does not scroll past the top', () => {
  const { edge, scrolledTo, mounted } = setup()
  edge.edgeScroll.begin(() => {})
  edge.edgeScroll.follow(110)
  runFrame()
  expect(scrolledTo).toEqual([])
  // And the loop has stopped rather than spinning at the limit.
  expect(frames).toEqual([])
  mounted.unmount()
})

test('the middle of the view never scrolls, and unmounting stops a held drag', () => {
  const { edge, scrolledTo, mounted } = setup(300)
  edge.edgeScroll.begin(() => {})
  edge.edgeScroll.follow(400)
  runFrame()
  expect(scrolledTo).toEqual([])

  edge.edgeScroll.follow(150)
  mounted.unmount()
  runFrame()
  expect(scrolledTo).toEqual([])
})

test('a measurement answered after its drag ended does not start the loop', () => {
  const { edge, scrolledTo, mounted } = setup()
  // The view answers late: hold its callback until after the drop.
  const late: (() => void)[] = []
  const probe = (edge.probeRef as { current: { measureInWindow: unknown } })
    .current
  const answer = probe.measureInWindow as (cb: (...a: number[]) => void) => void
  probe.measureInWindow = (cb: (...a: number[]) => void) =>
    late.push(() => answer(cb))
  edge.edgeScroll.begin(() => {})
  edge.edgeScroll.follow(790)
  edge.edgeScroll.end()
  for (const run of late) run()
  runFrame()
  expect(scrolledTo).toEqual([])
  expect(frames).toEqual([])
  mounted.unmount()
})
