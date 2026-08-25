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
 */
import { useRouter } from 'expo-router'
import { useEffect, useRef } from 'react'

import { useDrop } from './DropProvider'
import { dropHref } from './paths'

export function DropGate() {
  const { pending } = useDrop()
  const router = useRouter()
  const opened = useRef(0)

  useEffect(() => {
    if (!pending || pending.sequence === opened.current) return
    opened.current = pending.sequence
    router.push(dropHref())
  }, [pending, router])

  return null
}
