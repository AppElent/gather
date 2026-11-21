/**
 * Scrolling a list while a row is dragged near its top or bottom edge
 * (APP-534), so a row can travel further than one screen in one drop.
 *
 * The arithmetic is plain functions; `useEdgeScroll` owns a frame loop. The
 * loop scrolls the view with `scrollTo` and tells the drag how far the
 * content has moved since it began, which the drag adds to the finger's own
 * travel: the row stays under the finger while the rows beneath it slide past.
 *
 * Where the view is scrolled to is read once, when a drag begins, from a
 * probe at the very top of its content: the probe's distance from the view's
 * top on screen is the offset, whatever inset iOS added under a see-through
 * header. React Native's scroll events report the inset the app set, not the
 * one iOS adjusted, and lag a frame behind `scrollTo`; during the drag the
 * offset the loop asked for is the truth.
 *
 * No library: the drag runs on the JS thread already (`ReorderMode`), and a
 * drag-and-drop package is a native rebuild for one behaviour.
 */
import { useEffect, useMemo, useRef } from 'react'
import type { LayoutChangeEvent, View } from 'react-native'

/** How deep, in points, the band at each edge that scrolls the list is. */
export const EDGE_BAND = 72
/** The most a list scrolls in one frame, with the finger at the very edge. */
export const EDGE_MAX_STEP = 16

/**
 * Points to scroll this frame for a finger at `y`, in the same coordinates as
 * the visible window `top`–`bottom`: negative near the top, positive near the
 * bottom, faster the deeper into the band, and nothing in between. A window
 * too short for two bands and a middle never scrolls: every spot would be an
 * edge.
 */
export function edgeStep(
  y: number,
  top: number,
  bottom: number,
  band = EDGE_BAND,
  max = EDGE_MAX_STEP,
): number {
  if (bottom - top < band * 3) return 0
  const intoTop = top + band - y
  if (intoTop > 0) return -Math.ceil(max * Math.min(1, intoTop / band))
  const intoBottom = y - (bottom - band)
  if (intoBottom > 0) return Math.ceil(max * Math.min(1, intoBottom / band))
  return 0
}

/** A scroll view's position and the range it may scroll through. */
export interface ScrollMetrics {
  offset: number
  min: number
  max: number
}

/** The offset after a step, kept inside the scrollable range. */
export function stepped(metrics: ScrollMetrics, step: number): number {
  return Math.min(metrics.max, Math.max(metrics.min, metrics.offset + step))
}

/** What a drag needs from the scroll view it moves in. */
export interface EdgeScroll {
  /** A drag began: find where the scroll view sits and how far it scrolled. */
  begin: (onScrolled: (total: number) => void) => void
  /** The finger is at `absoluteY`, in window coordinates. */
  follow: (absoluteY: number | undefined) => void
  /** The drag ended: stop scrolling. */
  end: () => void
}

type Measured = (
  callback: (x: number, y: number, width: number, height: number) => void,
) => void

interface Scrollable {
  scrollTo: (options: { y: number; animated: boolean }) => void
  measureInWindow?: Measured
}

/** What covers the scroll view's top and bottom: a header, the home bar. */
export interface Insets {
  top: number
  bottom: number
}

/**
 * Edge scrolling for one scroll view: spread `scrollProps` onto it, put a
 * view with `probeRef` first in its content, and hand `edgeScroll` to the
 * drag. `insets` is what lies over the view's top and bottom edges — under a
 * see-through header the content starts below it, and so does the band.
 */
export function useEdgeScroll(
  scrollRef: React.RefObject<Scrollable | null>,
  insets: Insets,
) {
  const probeRef = useRef<React.ComponentRef<typeof View>>(null)
  const state = useRef({
    insets,
    content: 0,
    viewport: 0,
    offset: 0,
    start: 0,
    window: null as { top: number; bottom: number } | null,
    finger: undefined as number | undefined,
    frame: null as number | null,
    drag: 0,
    onScrolled: (_total: number) => {},
  }).current
  state.insets = insets

  const api = useMemo(() => {
    const stop = () => {
      if (state.frame !== null) cancelAnimationFrame(state.frame)
      state.frame = null
    }
    const tick = () => {
      state.frame = null
      if (state.finger === undefined || state.window === null) return
      const step = edgeStep(state.finger, state.window.top, state.window.bottom)
      if (step === 0) return
      const next = stepped(
        {
          offset: state.offset,
          min: -state.insets.top,
          max: Math.max(
            -state.insets.top,
            state.content - state.viewport + state.insets.bottom,
          ),
        },
        step,
      )
      // At the end of the list: wait for the finger to move again.
      if (next === state.offset) return
      scrollRef.current?.scrollTo({ y: next, animated: false })
      state.offset = next
      state.onScrolled(next - state.start)
      state.frame = requestAnimationFrame(tick)
    }
    const schedule = () => {
      if (state.frame === null) state.frame = requestAnimationFrame(tick)
    }

    const edgeScroll: EdgeScroll = {
      begin: (onScrolled) => {
        stop()
        const drag = ++state.drag
        state.onScrolled = onScrolled
        state.finger = undefined
        state.window = null
        const view = scrollRef.current?.measureInWindow
        const probe = probeRef.current?.measureInWindow as Measured | undefined
        if (!view || !probe) return
        view.call(scrollRef.current, (_x, top, _width, height) => {
          probe.call(probeRef.current, (_px, probeTop) => {
            // A later drag began before these answered.
            if (drag !== state.drag) return
            state.offset = top - probeTop
            state.start = state.offset
            state.window = {
              top: top + state.insets.top,
              bottom: top + height - state.insets.bottom,
            }
            if (state.finger !== undefined) schedule()
          })
        })
      },
      follow: (absoluteY) => {
        state.finger = absoluteY
        if (absoluteY !== undefined) schedule()
      },
      end: () => {
        stop()
        state.drag++
        state.finger = undefined
        state.window = null
      },
    }

    const scrollProps = {
      onContentSizeChange: (_width: number, height: number) => {
        state.content = height
      },
      onLayout: (event: LayoutChangeEvent) => {
        state.viewport = event.nativeEvent.layout.height
      },
    }

    return { edgeScroll, scrollProps }
  }, [scrollRef, state])

  // A screen that goes away mid-drag leaves no loop scrolling behind it.
  useEffect(() => api.edgeScroll.end, [api])

  return { ...api, probeRef }
}
