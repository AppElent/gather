/**
 * A Finances write that can fail, and the one way this Module says it did.
 *
 * Every write here used to be fired and forgotten, and the screen moved on as
 * if it had landed: a delete went back, a sheet closed, a new house was
 * assumed. `attempt` runs the write and does what came after it — navigating,
 * closing the sheet, clearing the draft — only once it has succeeded. A failure
 * plays the failure haptic, keeps the person where they are, and turns on
 * `failure`: one line in the Module's alert style, which the screen draws at
 * the top of its scroll and inside any sheet a write can fail from, so the
 * draft that did not save is still on screen beside the reason.
 *
 * A write that moves on afterwards (one with `then`: a sheet's Save, a delete
 * that goes back) runs one at a time: the sheet that used to vanish on the
 * first tap now waits for the answer, so a second Save tap would otherwise
 * add the same thing twice, and is ignored. A plain edit with no `then` (a
 * chip, a segment) always runs: each tap is a distinct choice, and dropping
 * one would lose it without a word.
 *
 * The words are `common.errors.didNotWork`: there is nothing more specific to
 * say about a refusal this Module never expects.
 */
import { useCallback, useRef, useState } from 'react'

import { haptics } from '../../feedback/haptics'
import { useI18n } from '../../i18n'
import { StaleBanner } from './ui'

export function useFinanceWrite() {
  const { t } = useI18n()
  const [failed, setFailed] = useState(false)
  const inFlight = useRef(false)

  const attempt = useCallback(
    <T,>(write: () => Promise<T>, then?: (value: T) => void) => {
      const guarded = then !== undefined
      if (guarded && inFlight.current) return
      if (guarded) inFlight.current = true
      setFailed(false)
      write().then(
        (value) => {
          if (guarded) inFlight.current = false
          then?.(value)
        },
        () => {
          if (guarded) inFlight.current = false
          haptics.actionFailed()
          setFailed(true)
        },
      )
    },
    [],
  )

  return {
    attempt,
    failure: failed ? <StaleBanner text={t.common.errors.didNotWork} /> : null,
  }
}
