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
 * closes it (`openSheets.ts`), and the chooser is pushed once it is gone. The
 * keyboard composer is a native modal and closes the same way. A prompt cannot
 * be closed from here, so the chooser waits for its answer, which then lands in
 * the form it was asked for before that form is closed (APP-672).
 */
import { useRouter } from 'expo-router'
import { useEffect, useRef } from 'react'

import {
  closeOpenSheets,
  hasOpenPrompts,
  hasOpenSheets,
  promptsAnswered,
} from '../components/openSheets'
import { useDrop } from './DropProvider'
import { dropHref } from './paths'

/** Rounds of closing, for a sheet that replaces one as it closes. */
const CLOSE_ROUNDS = 2

async function closeAllSheets() {
  await promptsAnswered()
  for (let round = 0; round < CLOSE_ROUNDS && hasOpenSheets(); round++) {
    await closeOpenSheets()
  }
}

export function DropGate() {
  const { pending } = useDrop()
  const router = useRouter()
  const opened = useRef(0)
  const mounted = useRef(true)
  // The Drop as of the last render, so a wait that ends reads the current one.
  const latest = useRef(pending)
  latest.current = pending

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    if (!pending || pending.sequence === opened.current) return
    opened.current = pending.sequence
    // A sheet is presented above the stack, so the chooser would open behind
    // it (APP-618): close any that are up, as their Close does, then push.
    if (!hasOpenSheets() && !hasOpenPrompts()) {
      router.push(dropHref())
      return
    }
    // Push only if this arrival is still the Drop in hand and the gate is still
    // mounted: a replacing share pushes for itself, a cleared Drop needs no
    // chooser, and a remounted gate opens the still-pending Drop on its own.
    const sequence = pending.sequence
    closeAllSheets().then(() => {
      if (mounted.current && latest.current?.sequence === sequence) {
        router.push(dropHref())
      }
    })
  }, [pending, router])

  return null
}
