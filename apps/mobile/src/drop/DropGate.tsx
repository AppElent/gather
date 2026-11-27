/**
 * Opening the chooser, once there is somewhere to open it.
 *
 * The Drop is captured at the root, above the signed-in check and above the
 * Group provider's pending/none screens, because a share can arrive at an app
 * that is signed out or still asking which Groups exist. The chooser cannot be
 * pushed from up there: it needs the Group, and it needs the authenticated
 * stack to exist to be pushed onto.
 *
 * So this sits one layer down, inside both gates, and does the only thing left
 * — notice that a Drop has arrived and put the question in front of somebody.
 * A person who shared while signed out signs in and finds the chooser waiting,
 * which is the behaviour falling out of where the payload is held rather than
 * a case anybody had to write.
 *
 * ## Why a sequence and not a boolean
 *
 * The signed-in tree remounts for ordinary reasons — a Group switch unwinds
 * every tab stack — and each remount would re-push the chooser for a Drop
 * somebody is halfway through answering. Remembering *which arrival* was
 * already opened makes a replacement Drop reopen the chooser and a remount not.
 *
 * ## Sheets
 *
 * A `NativeSheet` is presented natively above the navigation stack, so a push
 * lands behind it. An open sheet is closed first, the same way its own Close
 * closes it (`shell/linkAfterSheets.ts`), and the chooser is pushed once it is
 * gone. The keyboard composer is a native modal and closes the same way. A
 * prompt cannot be closed from here, so the chooser waits for its answer, which
 * then lands in the form it was asked for before that form is closed (APP-672).
 * A link, a notification or a quick action that arrives while it waits replaces
 * it (APP-774): the newer screen opens, and once that arrival has opened and
 * nothing is in front of it the chooser comes back for the Drop that is still
 * pending (APP-817). It is the arrival opening that brings it back, never the
 * person's next move. No new control: the same chooser, a moment later.
 */
import { usePathname, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef } from 'react'

import {
  hasOpenPrompts,
  hasOpenSheets,
  isPromptSettling,
} from '../components/openSheets'
import { isWaitingForSheets, openAfterSheets } from '../shell/linkAfterSheets'
import { useDrop } from './DropProvider'
import { dropHref } from './paths'

/**
 * How long, after the newer arrival opened, the chooser waits for a hand-off
 * route or the quick sheet to be done before it gives up.
 */
export const REOFFER_WINDOW_MS = 5000

/**
 * How long the newer screen gets to present what it opens, a sheet or a
 * prompt, before the chooser looks for something in front.
 */
export const REOFFER_SETTLE_MS = 400

/** The route a tapped notification passes through on its way to its record. */
const HANDOFF_PATH = '/open-notification'

/** The route the home-screen quick actions open the quick sheet on. */
const QUICK_PATH = '/quick'

/** Whether `pathname` is the Drop chooser or one of its nested routes. */
function isDropPath(pathname: string) {
  const root = dropHref()
  return (
    typeof root === 'string' &&
    (pathname === root || pathname.startsWith(`${root}/`))
  )
}

export function DropGate() {
  const { pending } = useDrop()
  const router = useRouter()
  const opened = useRef(0)
  const mounted = useRef(true)
  // The Drop as of the last render, so a wait that ends reads the current one.
  const latest = useRef(pending)
  latest.current = pending
  const pathname = usePathname()
  const here = useRef(pathname)
  here.current = pathname
  // Which re-offer is live: a newer one, or the gate going, ends the older.
  const reoffer = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      reoffer.current++
      clearTimeout(timer.current)
    }
  }, [])

  // Once the chooser itself is reached, any waiting re-offer is done: moving
  // on from it (to `/drop/pick` or a `keepsDrop` screen) inside
  // `REOFFER_SETTLE_MS` must not bring the chooser back over the next screen.
  useEffect(() => {
    if (!isDropPath(pathname)) return
    reoffer.current++
    clearTimeout(timer.current)
  }, [pathname])

  // The newer arrival opened: give it a moment to present what it opens, then
  // bring the chooser back unless something is in front of it. It is the
  // arrival opening that starts this, not the person's next move, so a
  // navigation after the newer screen settled never brings the chooser back.
  const bringBack = useCallback(
    (sequence: number, newerOpened: Promise<boolean>) => {
    const token = ++reoffer.current
    clearTimeout(timer.current)
    void newerOpened.then((went) => {
      if (!went || token !== reoffer.current) return
      const deadline = Date.now() + REOFFER_WINDOW_MS
      const settle = () => {
        if (!mounted.current || token !== reoffer.current) return
        if (latest.current?.sequence !== sequence) return
        // Still on the way: the notification hand-off, or the quick sheet.
        if (here.current === HANDOFF_PATH || here.current === QUICK_PATH) {
          if (Date.now() < deadline)
            timer.current = setTimeout(settle, REOFFER_SETTLE_MS)
          return
        }
        if (
          isDropPath(here.current) ||
          hasOpenSheets() ||
          hasOpenPrompts() ||
          isPromptSettling() ||
          isWaitingForSheets()
        )
          return
        router.push(dropHref())
      }
      timer.current = setTimeout(settle, REOFFER_SETTLE_MS)
    })
  },
    [router],
  )

  useEffect(() => {
    if (!pending || pending.sequence === opened.current) return
    opened.current = pending.sequence
    // A sheet is presented above the stack, so the chooser would open behind
    // it (APP-618): close any that are up, as their Close does, then push.
    // Push only if this arrival is still the Drop in hand and the gate is still
    // mounted: a replacing share pushes for itself, a cleared Drop needs no
    // chooser, and a remounted gate opens the still-pending Drop on its own.
    const sequence = pending.sequence
        openAfterSheets(() => router.push(dropHref()), {
      share: true,
      wanted: () => mounted.current && latest.current?.sequence === sequence,
      onSuperseded: (newerOpened) => {
        if (mounted.current) bringBack(sequence, newerOpened)
      },
    })
  }, [pending, router, bringBack])

  return null
}
