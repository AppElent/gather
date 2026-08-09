import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import {
  DETENTS,
  type Detent,
  DRAG_THRESHOLD_PX,
  releaseDetent,
  rubberBand,
} from './sheetDetents'

interface Props {
  /** Names the sheet for assistive technology; the visible title is `header`. */
  label: string
  header: ReactNode
  children: ReactNode
  onClose: () => void
  /** Raised to full whenever this changes to true — focusing the search does it. */
  promoteToFull?: number
}

/** Which surface a gesture belongs to, once there is enough of it to tell. */
type Owner = 'sheet' | 'list'

/**
 * Freezes the page behind the sheet for as long as the sheet is mounted.
 *
 * `overflow: hidden` on `body` is not enough — iOS Safari scrolls the document
 * anyway — so the body is taken out of flow at its current offset and put back
 * where it was on the way out. Without this the sheet is a `fixed` layer over a
 * live, scrollable diary, and every gesture the sheet does not claim reaches
 * the diary instead.
 */
function useScrollLock() {
  useEffect(() => {
    const { body } = document
    const y = window.scrollY
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    }
    body.style.position = 'fixed'
    body.style.top = `${-y}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.width = '100%'
    body.style.overflow = 'hidden'
    return () => {
      Object.assign(body.style, previous)
      window.scrollTo(0, y)
    }
  }, [])
}

/**
 * The area actually visible, which stops being the layout viewport the moment a
 * software keyboard opens: `vh` and `bottom: 0` go on describing the taller,
 * unchanged page while the keyboard covers the bottom of it, and a sheet pinned
 * to that bottom takes its header — where the search field lives — off screen.
 *
 * Returns `null` where the API is missing, and the `dvh` fallback in the class
 * list takes over.
 */
function useVisualViewport() {
  const [box, setBox] = useState<{ height: number; offsetTop: number } | null>(
    null,
  )
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const read = () => setBox({ height: vv.height, offsetTop: vv.offsetTop })
    read()
    vv.addEventListener('resize', read)
    vv.addEventListener('scroll', read)
    return () => {
      vv.removeEventListener('resize', read)
      vv.removeEventListener('scroll', read)
    }
  }, [])
  return box
}

/**
 * A sheet that comes up from the bottom of the screen and rests at one of three
 * heights: peek, full, or gone.
 *
 * Draggable by its handle, its header and its list, because on a phone the
 * thing under your thumb is whatever happens to be there. The arithmetic —
 * which detent a release lands on, what a flick beats, how far past full a drag
 * may stretch — is in `sheetDetents.ts` and tested there.
 *
 * What lives here is gesture ownership, which is the whole difficulty. Three
 * rules, and none of them is optional:
 *
 * 1. **The page behind is frozen** (`useScrollLock`). A gesture nobody claims
 *    must land on nothing, not on the diary.
 * 2. **Ownership is settled on the first move, not on `pointerdown`** — at
 *    `pointerdown` there is no direction yet, and direction is half the answer.
 *    The list keeps a gesture whenever it has somewhere to go that way; only a
 *    pull *downwards* from the top of it belongs to the sheet.
 * 3. **`touch-action` is set to match, ahead of the gesture.** The browser
 *    decides whether to pan from `touch-action` at touch-start, and once it has
 *    started panning, `preventDefault` on a *pointer* event will not take it
 *    back. So the list only advertises `pan-y` when it can actually scroll, and
 *    the one case that remains — pulling the sheet down by a list that is at its
 *    top — is refused by a non-passive `touchmove`, on the first move, before
 *    any scrolling has begun.
 *
 * Closing is the caller's business, not the sheet's: this one has an address,
 * so closing it is a navigation and the sheet only says when it was asked for.
 */
export function BottomSheet({
  label,
  header,
  children,
  onClose,
  promoteToFull,
}: Props) {
  const [detent, setDetent] = useState<Detent>('peek')
  const [frac, setFracState] = useState(1)
  const [dragging, setDragging] = useState(false)
  // The drag reads the position it is moving from on every pointer event, and
  // reading it out of state would be reading last render's value.
  const fracRef = useRef(1)
  const setFrac = useCallback((next: number) => {
    fracRef.current = next
    setFracState(next)
  }, [])
  const bodyRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{
    pointerId: number
    active: boolean
    owner: Owner | null
    fromList: boolean
    startY: number
    startFrac: number
    lastY: number
    lastT: number
    velocity: number
  }>({
    pointerId: -1,
    active: false,
    owner: null,
    fromList: false,
    startY: 0,
    startFrac: 1,
    lastY: 0,
    lastT: 0,
    velocity: 0,
  })
  // A drag that ends on a row must not also activate it. Set for exactly one
  // click, which is the one the browser fires after the pointer goes up.
  const suppressClick = useRef(false)

  useScrollLock()
  const viewport = useVisualViewport()

  // Comes up from off-screen on mount rather than appearing at peek, so the
  // sheet reads as arriving from the bottom edge the way it will leave by it.
  useEffect(() => {
    const id = requestAnimationFrame(() => setFrac(DETENTS.peek))
    return () => cancelAnimationFrame(id)
  }, [setFrac])

  useEffect(() => {
    if (promoteToFull === undefined) return
    setDetent('full')
    setFrac(DETENTS.full)
  }, [promoteToFull, setFrac])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const settle = useCallback(
    (next: Detent) => {
      if (next === 'closed') {
        onClose()
        return
      }
      setDetent(next)
      setFrac(DETENTS[next])
    },
    [onClose, setFrac],
  )

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    // A field is being used, not dragged from.
    if (target.closest('input, select, textarea')) return
    drag.current = {
      pointerId: e.pointerId,
      active: true,
      // Undecided on purpose: see rule 2 above.
      owner: null,
      fromList: bodyRef.current?.contains(target) ?? false,
      startY: e.clientY,
      startFrac: fracRef.current,
      lastY: e.clientY,
      lastT: performance.now(),
      velocity: 0,
    }
  }, [])

  useEffect(() => {
    /** Rule 2: who this gesture is for, now that its direction is known. */
    const claimedBySheet = (fromList: boolean, dy: number) => {
      const body = bodyRef.current
      // The handle and the header are the sheet's, always.
      if (!fromList || !body) return true
      // At peek the list does not scroll at all, so there is nothing to lose it
      // to.
      if (detent !== 'full') return true
      // Otherwise only a pull downwards from the very top of the list.
      return dy > 0 && body.scrollTop <= 0
    }

    // Native rather than React handlers: React attaches its own as passive, and
    // the touch listener below has to be able to preventDefault.
    const onMove = (e: PointerEvent) => {
      const d = drag.current
      if (!d.active || e.pointerId !== d.pointerId) return
      const dy = e.clientY - d.startY
      if (d.owner === null) {
        if (Math.abs(dy) < DRAG_THRESHOLD_PX) return
        if (!claimedBySheet(d.fromList, dy)) {
          // The list's. Stand down for the rest of the gesture rather than
          // reconsidering on every move, which would let a wobble steal it.
          d.owner = 'list'
          d.active = false
          return
        }
        d.owner = 'sheet'
        // Without capture a fast drag that leaves the sheet loses its moves.
        // Refused for a pointer the browser no longer considers active, which
        // is not a reason to drop the drag — the window listeners still run.
        try {
          sheetRef.current?.setPointerCapture(d.pointerId)
        } catch {}
        setDragging(true)
      }
      const height = sheetRef.current?.getBoundingClientRect().height ?? 1
      const now = performance.now()
      if (now > d.lastT) d.velocity = (e.clientY - d.lastY) / (now - d.lastT)
      d.lastY = e.clientY
      d.lastT = now
      setFrac(rubberBand(d.startFrac + dy / height))
      e.preventDefault()
    }

    // Rule 3. `preventDefault` on a pointer event does not stop a scroll the
    // browser has already claimed; only a non-passive `touchmove` does, and
    // only while it is still cancelable — which is why ownership is decided on
    // the first move rather than the fifth.
    const onTouchMove = (e: TouchEvent) => {
      if (drag.current.owner === 'sheet' && e.cancelable) e.preventDefault()
    }

    const onUp = (e: PointerEvent) => {
      const d = drag.current
      if (!d.active || e.pointerId !== d.pointerId) return
      d.active = false
      const owned = d.owner === 'sheet'
      d.owner = null
      try {
        if (sheetRef.current?.hasPointerCapture(d.pointerId)) {
          sheetRef.current.releasePointerCapture(d.pointerId)
        }
      } catch {}
      if (!owned) return
      setDragging(false)
      suppressClick.current = true
      setTimeout(() => {
        suppressClick.current = false
      }, 0)
      settle(releaseDetent(fracRef.current, d.velocity, detent))
    }

    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [detent, settle, setFrac])

  return (
    // Pinned to the *visible* area rather than to `inset-0`, so that "the
    // bottom" stays the bottom of what you can see once the keyboard is up.
    <div
      className="fixed inset-x-0 top-0 z-50 h-[100dvh]"
      style={
        viewport
          ? { height: viewport.height, top: viewport.offsetTop }
          : undefined
      }
    >
      {/* The scrim is a convenience for a pointer; Escape and the header's
          close button are the ways out that do not need one, which is why it
          is out of the tab order and hidden from assistive technology. */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-black/30 transition-opacity"
        style={{ opacity: (1 - frac) * 0.9 }}
      />
      <section
        ref={sheetRef}
        aria-label={label}
        className="absolute inset-x-0 bottom-0 flex h-[92%] flex-col rounded-t-2xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-2xl"
        style={{
          transform: `translate3d(0, ${frac * 100}%, 0)`,
          transition: dragging
            ? 'none'
            : 'transform 260ms cubic-bezier(.32,.72,0,1)',
          touchAction: 'none',
        }}
        onPointerDown={onPointerDown}
        onClickCapture={(e) => {
          if (!suppressClick.current) return
          e.stopPropagation()
          e.preventDefault()
        }}
      >
        <div className="flex justify-center pt-2 pb-1">
          <span
            aria-hidden="true"
            className="h-1 w-10 rounded-full bg-[var(--app-border)]"
          />
        </div>
        <div className="flex-none px-4 pb-2">{header}</div>
        {/* `overflow-x-hidden` is not decoration. Setting either axis to
            something other than `visible` makes the other compute to `auto`, so
            leaving it alone did not mean "no horizontal overflow" — it meant
            the body was horizontally scrollable, and anything inside it that
            outgrew the sheet took the sheet sideways rather than being clipped
            by it (#83). Clipping keeps a future unshrinkable child contained.

            This does not touch rule 3: `touch-action` is unchanged, and it
            already refused horizontal panning at every detent. All that goes
            away is a scrollable overflow region nothing was meant to reach. */}
        <div
          ref={bodyRef}
          className={`flex-1 overflow-x-hidden px-4 pb-8 ${
            detent === 'full' ? 'overflow-y-auto' : 'overflow-y-hidden'
          }`}
          style={{
            overscrollBehavior: 'contain',
            // Rule 3: only advertise a pan the list can actually perform.
            touchAction: detent === 'full' ? 'pan-y' : 'none',
          }}
        >
          {children}
        </div>
      </section>
    </div>
  )
}
