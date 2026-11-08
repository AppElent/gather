import { useEffect } from 'react'

/** Sheets holding the lock, and how to put the page back once none do. */
let holders = 0
let release: (() => void) | null = null

/**
 * Freezes the page behind a sheet for as long as `active` holds.
 *
 * `overflow: hidden` on `body` is not enough — iOS Safari scrolls the document
 * anyway — so the body is taken out of flow at its current offset and put back
 * where it was on the way out. Without this a sheet is a `fixed` layer over a
 * live, scrollable page, and every gesture the sheet does not claim reaches
 * the page instead.
 *
 * A sheet opened over a sheet shares the lock rather than taking it again: a
 * frozen body reports no scroll offset, so a second lock would move the page
 * to the top. The page is put back when the last sheet lets go.
 */
export function useScrollLock(active = true) {
  useEffect(() => {
    if (!active) return
    if (holders === 0) release = lockBody()
    holders += 1
    return () => {
      holders -= 1
      if (holders === 0) {
        release?.()
        release = null
      }
    }
  }, [active])
}

function lockBody(): () => void {
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
}
