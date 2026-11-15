import * as Brightness from 'expo-brightness'
import { useEffect } from 'react'
import { AppState, Platform } from 'react-native'

/**
 * Full screen brightness while a card is shown at the till, and the person's
 * own brightness back the moment it is not.
 *
 * The platforms differ in what "the screen's brightness" is:
 *
 * - **Android** sets this window's brightness. Nothing else on the phone is
 *   touched, and `restoreSystemBrightnessAsync` hands the window back to the
 *   system setting.
 * - **iOS** has one brightness for the whole device, so the value from before
 *   is read and written back, and it is written back when the app leaves the
 *   foreground too — otherwise a phone pocketed on this screen would stay at
 *   full brightness everywhere. Coming back raises it again.
 *
 * Raising and restoring run one after the other, never interleaved — across
 * screens too, so leaving one card and opening the next cannot read the first
 * card's full brightness as the person's own.
 *
 * Every call is best effort: a phone that refuses (or a simulator, which has
 * no brightness) still shows the card, and the failure is not worth a report.
 */
let queue: Promise<void> = Promise.resolve()
function run(step: () => Promise<void>) {
  queue = queue.then(step)
}

export function useTillBrightness(active = true) {
  useEffect(() => {
    if (!active) return
    let before: number | null = null
    let raised = false

    const raise = async () => {
      if (raised) return
      raised = true
      try {
        if (Platform.OS === 'ios') {
          before = await Brightness.getBrightnessAsync()
        }
        await Brightness.setBrightnessAsync(1)
      } catch {
        // Best effort; see above.
      }
    }

    const restore = async () => {
      if (!raised) return
      raised = false
      try {
        if (Platform.OS === 'android') {
          await Brightness.restoreSystemBrightnessAsync()
        } else if (before !== null) {
          await Brightness.setBrightnessAsync(before)
          before = null
        }
      } catch {
        // Best effort; see above.
      }
    }

    run(raise)
    const subscription = AppState.addEventListener('change', (state) => {
      run(state === 'active' ? raise : restore)
    })
    return () => {
      subscription.remove()
      run(restore)
    }
  }, [active])
}
