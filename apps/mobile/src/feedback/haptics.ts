/**
 * The phone's haptic vocabulary, as decided in `docs/mobile-interaction.md`.
 *
 * **Call sites name events, never intensities.** `haptics.itemCompleted()`, not
 * `impactAsync(Heavy)` — so that the question "how hard should completing a task
 * feel" is answered once, here, instead of being re-answered by whoever writes
 * the next screen. It is also the only place Android's own vocabulary differs
 * from iOS's, and the only place a future "reduce haptics" preference would go.
 *
 * **Nothing here is ever the only signal.** iOS silently plays nothing in Low
 * Power Mode, when the user has turned haptics off, while the camera is open,
 * and during dictation. A confirmation that exists only as a buzz did not
 * happen for those people.
 *
 * Every call is fire-and-forget and swallows its rejection: a haptic that fails
 * is not an error worth surfacing, and it must never take a save down with it.
 */
import * as Haptics from 'expo-haptics'

const isAndroid = process.env.EXPO_OS === 'android'

/** Fire-and-forget. A failed haptic is not a failure the user needs told about. */
function play(run: () => Promise<void>) {
  run().catch(() => {})
}

export const haptics = {
  /** A toggle, a segmented control, a picker step: the selection moved. */
  selectionChanged() {
    play(() => Haptics.selectionAsync())
  },

  /** A record was written — a quick add saved, a form submitted. */
  itemSaved() {
    play(() =>
      isAndroid
        ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm)
        : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    )
  },

  /** A task completed, an item ticked off. Same feel as a save: an outcome. */
  itemCompleted() {
    play(() =>
      isAndroid
        ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm)
        : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    )
  },

  /** Validation refused the input, or a write came back rejected. */
  actionFailed() {
    play(() =>
      isAndroid
        ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Reject)
        : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
    )
  },

  /**
   * A swipe crossed the point where releasing would act. The one haptic that
   * genuinely carries information: it is how you know you have gone far enough
   * without watching the row.
   */
  swipeThresholdPassed() {
    play(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light))
  },

  /** A press-and-hold opened a context menu. */
  menuOpened() {
    play(() =>
      isAndroid
        ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Long_Press)
        : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
    )
  },

  /** A pull-to-refresh passed its threshold and fired. */
  refreshStarted() {
    play(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light))
  },
}
