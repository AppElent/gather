/**
 * Scrolling a list while a row is dragged near its top or bottom edge
 * (APP-534), so a row can travel further than one screen in one drop.
 *
 * The arithmetic is plain functions; `useEdgeScroll` owns the scroll view's
 * metrics and a frame loop. The loop scrolls the view with `scrollTo` and
 * tells the drag how far the content has moved since it began, which the drag
 * adds to the finger's own travel: the row stays under the finger while the
 * rows beneath it slide past.
 *
 * No library: the drag runs on the JS thread already (`ReorderMode`), and a
 * drag-and-drop package is a native rebuild for one behaviour.
 */
import { useMemo, useRef } from 'react'
import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native'

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
  /** A drag began: find where the scroll view sits on screen. */
  begin: (onScrolled: (total: number) => void) => void
  /** The finger is at `absoluteY`, in window coordinates. */
  follow: (absoluteY: number | undefined) => void
  /** The drag ended: stop scrolling. */
  end: () => void
}

interface Scrollable {
  scrollTo: (options: { y: number; animated: boolean }) => void
  measureInWindow?: (
    callback: (x: number, y: number, width: number, height: number) => void,
  ) => void
}

/**
 * Edge scrolling for one scroll view: spread `scrollProps` onto it and hand
 * `edgeScroll` to the drag.
 */
export function useEdgeScroll(scrollRef: React.RefObject<Scrollable | null>) {
  const state = useRef({
    // Before the first scroll event the view sits at rest; on iOS that is
    // the top of the content, under any automatic inset.
    offset: 0,
    insetTop: 0,
    insetBottom: 0,
    content: 0,
    viewport: 0,
    window: { top: 0, bottom: 0 },
    finger: undefined as number | undefined,
    total: 0,
    frame: null as number | null,
    onScrolled: (_total: number) => {},
  }).current

  return useMemo(() => {
    const metrics = (): ScrollMetrics => ({
      offset: state.offset,
      min: -state.insetTop,
      max: Math.max(
        -state.insetTop,
        state.content - state.viewport + state.insetBottom,
      ),
    })
    const stop = () => {
      if (state.frame !== null) cancelAnimationFrame(state.frame)
      state.frame = null
    }
    const tick = () => {
      state.frame = null
      if (state.finger === undefined) return
      const step = edgeStep(state.finger, state.window.top, state.window.bottom)
      if (step === 0) return
      const next = stepped(metrics(), step)
      const moved = next - state.offset
      if (moved !== 0) {
        scrollRef.current?.scrollTo({ y: next, animated: false })
        state.offset = next
        state.total += moved
        state.onScrolled(state.total)
      }
      state.frame = requestAnimationFrame(tick)
    }

    const edgeScroll: EdgeScroll = {
      begin: (onScrolled) => {
        state.onScrolled = onScrolled
        state.total = 0
        state.finger = undefined
        scrollRef.current?.measureInWindow?.((_x, y, _width, height) => {
          state.window = { top: y, bottom: y + height }
        })
      },
      follow: (absoluteY) => {
        state.finger = absoluteY
        if (absoluteY !== undefined && state.frame === null)
          state.frame = requestAnimationFrame(tick)
      },
      end: () => {
        stop()
        state.finger = undefined
      },
    }

    const scrollProps = {
      scrollEventThrottle: 16,
      onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const { contentOffset, contentInset, contentSize, layoutMeasurement } =
          event.nativeEvent
        state.offset = contentOffset.y
        state.insetTop = contentInset?.top ?? 0
        state.insetBottom = contentInset?.bottom ?? 0
        state.content = contentSize.height
        state.viewport = layoutMeasurement.height
      },
      onContentSizeChange: (_width: number, height: number) => {
        state.content = height
      },
      onLayout: (event: LayoutChangeEvent) => {
        state.viewport = event.nativeEvent.layout.height
      },
    }

    return { edgeScroll, scrollProps }
  }, [scrollRef, state])
}
