/**
 * Capture, as one thing three screens can start.
 *
 * The flow is always the same two steps — pick or type the subject in a sheet,
 * then rate it on a pushed screen — and it is reachable from three places: the
 * Add launcher, the `+` in a Module index's header, and the empty state's one
 * button. Without this they would be three copies of "open the sheet, then
 * push the composer with whichever half of the choice arrived", and the third
 * copy is where the params would drift.
 *
 * The sheet is dismissed *before* the push, deliberately: a sheet still
 * presented while a screen slides in under it is the one animation that reads
 * as a bug on both platforms.
 */
import type { TastingKind } from '@gather/core/tastings'
import { useRouter } from 'expo-router'
import type { ReactNode } from 'react'
import { useCallback, useState } from 'react'

import type { TastingBase } from './paths'
import { tastingHref } from './paths'
import { type SubjectChoice, SubjectPickerSheet } from './SubjectPickerSheet'

export interface Capture {
  kind: TastingKind
  open: () => void
  close: () => void
  picking: boolean
  choose: (choice: SubjectChoice) => void
}

export function useCapture(base: TastingBase, kind: TastingKind): Capture {
  const router = useRouter()
  const [picking, setPicking] = useState(false)

  const choose = useCallback(
    (choice: SubjectChoice) => {
      setPicking(false)
      router.push(
        tastingHref(base, kind, '/compose', {
          mode: 'new',
          ...('subjectId' in choice
            ? { subjectId: choice.subjectId }
            : {
                name: choice.name,
                ...(choice.catalogKey ? { catalogKey: choice.catalogKey } : {}),
              }),
        }),
      )
    },
    [base, kind, router],
  )

  return {
    kind,
    picking,
    open: () => setPicking(true),
    close: () => setPicking(false),
    choose,
  }
}

/** The sheet half. Renders nothing until somebody starts the flow. */
export function CaptureFlow({
  capture,
  leading,
}: {
  capture: Capture
  leading?: ReactNode
}) {
  if (!capture.picking) return null
  return (
    <SubjectPickerSheet
      kind={capture.kind}
      onChoose={capture.choose}
      onClose={capture.close}
      leading={leading}
    />
  )
}
