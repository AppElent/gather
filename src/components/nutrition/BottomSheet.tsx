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

/**
 * A sheet that comes up from the bottom of the screen and rests at one of three
 * heights: peek, full, or gone.
 *
 * Draggable by its handle, its header and its list, because on a phone the
 * thing under your thumb is whatever happens to be there. The arithmetic —
 * which detent a release lands on, what a flick beats, how far past full a drag
 * may stretch — is in `sheetDetents.ts` and tested there. What lives here is
 * the plumbing that arithmetic needs: pointer capture, the tap-versus-drag
 * threshold, and the rule that a drag starting inside a scrolled list belongs
 * to the list rather than to the sheet.
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
  const drag = useRef({
    pending: false,
    moved: false,
    startY: 0,
    startFrac: 1,
    lastY: 0,
    lastT: 0,
    velocity: 0,
  })
  // A drag that ends on a row must not also activate it. Set for exactly one
  // click, which is the one the browser fires after the pointer goes up.
  const suppressClick = useRef(false)

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

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return
      const target = e.target as HTMLElement
      // A field is being used, not dragged from.
      if (target.closest('input, select, textarea')) return
      // At full height the list scrolls. Only a drag that starts at the very
      // top of it belongs to the sheet — anywhere else and the list would be
      // fighting the sheet for the same gesture.
      const body = bodyRef.current
      if (body?.contains(target) && detent === 'full' && body.scrollTop > 0) {
        return
      }
      drag.current = {
        pending: true,
        moved: false,
        startY: e.clientY,
        startFrac: DETENTS[detent],
        lastY: e.clientY,
        lastT: performance.now(),
        velocity: 0,
      }
    },
    [detent],
  )

  useEffect(() => {
    // Native rather than React handlers: a move listener has to be able to
    // preventDefault to stop the page rubber-banding under the sheet, and
    // React attaches its own as passive.
    const onMove = (e: PointerEvent) => {
      const d = drag.current
      if (!d.pending) return
      const dy = e.clientY - d.startY
      if (!d.moved) {
        if (Math.abs(dy) < DRAG_THRESHOLD_PX) return
        d.moved = true
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

    const onUp = () => {
      const d = drag.current
      if (!d.pending) return
      d.pending = false
      if (!d.moved) return
      d.moved = false
      setDragging(false)
      suppressClick.current = true
      setTimeout(() => {
        suppressClick.current = false
      }, 0)
      settle(releaseDetent(fracRef.current, d.velocity, detent))
    }

    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [detent, settle, setFrac])

  return (
    <div className="fixed inset-0 z-50">
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
        className="absolute inset-x-0 bottom-0 flex h-[92vh] flex-col rounded-t-2xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-2xl"
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
        <div
          ref={bodyRef}
          className={`flex-1 px-4 pb-8 ${
            detent === 'full' ? 'overflow-y-auto' : 'overflow-y-hidden'
          }`}
          style={{ overscrollBehavior: 'contain', touchAction: 'pan-y' }}
        >
          {children}
        </div>
      </section>
    </div>
  )
}
