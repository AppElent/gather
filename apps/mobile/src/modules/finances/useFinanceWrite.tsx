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
 * One write at a time: while one is in flight a second tap is ignored, since
 * the sheet that used to vanish on the first tap now waits for the answer and
 * a second Save would otherwise add the same thing twice.
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
      if (inFlight.current) return
      inFlight.current = true
      setFailed(false)
      write().then(
        (value) => {
          inFlight.current = false
          then?.(value)
        },
        () => {
          inFlight.current = false
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
