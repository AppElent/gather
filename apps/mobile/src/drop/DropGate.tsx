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
 * it (APP-774): the newer screen opens, and once it is up with nothing in front
 * of it the chooser comes back for the Drop that is still pending (APP-817).
 * No new control: the chooser is the same one, a moment later.
 */
import { usePathname, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'

import { hasOpenPrompts, hasOpenSheets } from '../components/openSheets'
import { isWaitingForSheets, openAfterSheets } from '../shell/linkAfterSheets'
import { useDrop } from './DropProvider'
import { dropHref } from './paths'

/**
 * How long a replaced Drop waits for the newer screen to open. A newer link to
 * the screen already in front changes no path, and a chooser that came much
 * later would be a surprise.
 */
export const REOFFER_WINDOW_MS = 5000

/**
 * How long the newer screen gets to present what it opens, a sheet or a
 * prompt, before the chooser looks for something in front.
 */
export const REOFFER_SETTLE_MS = 400

/** The route a tapped notification passes through on its way to its record. */
const HANDOFF_PATH = '/open-notification'

export function DropGate() {
  const { pending } = useDrop()
  const router = useRouter()
  const opened = useRef(0)
  const mounted = useRef(true)
  // The Drop as of the last render, so a wait that ends reads the current one.
  const latest = useRef(pending)
  latest.current = pending
  // The chooser of this Drop lost its place to a newer arrival: which Drop,
  // and the screen it was waiting on, so the newer screen's path can be told
  // from it.
  const pathname = usePathname()
  const here = useRef(pathname)
  here.current = pathname
  const [lost, setLost] = useState<{ sequence: number; from: string } | null>(
    null,
  )

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // Gives up when the newer screen takes too long, or never changes the path.
  useEffect(() => {
    if (!lost) return
    const timer = setTimeout(() => setLost(null), REOFFER_WINDOW_MS)
    return () => clearTimeout(timer)
  }, [lost])

  // The newer screen is up: bring the chooser back, unless something is in
  // front of it (a sheet or prompt the arrival opened), which is left alone.
  useEffect(() => {
    if (
      !lost ||
      pathname === lost.from ||
      pathname === HANDOFF_PATH ||
      pathname === dropHref()
    )
      return
    const timer = setTimeout(() => {
      setLost(null)
      if (!mounted.current || latest.current?.sequence !== lost.sequence) return
      if (hasOpenSheets() || hasOpenPrompts() || isWaitingForSheets()) return
      router.push(dropHref())
    }, REOFFER_SETTLE_MS)
    return () => clearTimeout(timer)
  }, [lost, pathname, router])

  useEffect(() => {
    if (!pending || pending.sequence === opened.current) return
    opened.current = pending.sequence
    // A sheet is presented above the stack, so the chooser would open behind
    // it (APP-618): close any that are up, as their Close does, then push.
    // Push only if this arrival is still the Drop in hand and the gate is still
    // mounted: a replacing share pushes for itself, a cleared Drop needs no
    // chooser, and a remounted gate opens the still-pending Drop on its own.
    const sequence = pending.sequence
    const from = here.current
    openAfterSheets(() => router.push(dropHref()), {
      share: true,
      wanted: () => mounted.current && latest.current?.sequence === sequence,
      onSuperseded: () => {
        if (mounted.current) setLost({ sequence, from })
      },
    })
  }, [pending, router])

  return null
}
