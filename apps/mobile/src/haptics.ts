/**
 * The taps the phone makes.
 *
 * ## Why a wrapper rather than calling `expo-haptics` directly
 *
 * Three reasons, and only the first is about tidiness.
 *
 * **Every call is fire-and-forget.** `expo-haptics` returns a promise that
 * rejects on a device with no Taptic Engine, on Android without the vibrate
 * permission, and on web. An unhandled rejection in a button handler is a
 * red box over a screen that worked fine, so each verb swallows its own.
 * Nothing here is ever awaited and nothing here can fail a user's action.
 *
 * **The vocabulary is the app's, not the API's.** `ImpactFeedbackStyle.Medium`
 * says how hard; `lifted()` says what happened. Naming them after the event
 * keeps the same physical feedback on the same kind of moment across screens,
 * which is the entire point — a haptic language a person learns in one place
 * and recognises in another. Two screens picking different intensities for
 * "saved" is how that stops working.
 *
 * **iOS is where this matters and Android is where it can annoy.** On iOS the
 * Taptic Engine is precise and expected; feedback is part of what "native"
 * feels like. Android's is a coarse motor on most devices, and the platform's
 * own convention is far sparser. So `selected()` — the one that fires
 * repeatedly, on every step of a stepper and every swap of a drag — is iOS
 * only. The one-shot verbs fire on both.
 *
 * ## When to add one
 *
 * Sparingly, and only where something *happened*: a value committed, a thing
 * picked up, a record written or refused. Never on navigation, never on a plain
 * tap that only opens something, and never on anything that repeats faster than
 * a person can feel it as separate events. A phone that buzzes at everything
 * teaches people to ignore it, at which point the ones that mattered are gone
 * too.
 */
import * as Haptics from 'expo-haptics'

const IOS = process.env.EXPO_OS === 'ios'

/** Swallowed on purpose — see the note above. */
const quietly = (run: () => Promise<unknown>) => {
  void run().catch(() => {})
}

export const haptics = {
  /**
   * A value moved by one notch — a stepper, a drag crossing into a new slot.
   * iOS only: this is the one that repeats.
   */
  selected: () => {
    if (IOS) quietly(() => Haptics.selectionAsync())
  },

  /** Something was picked up and is now being carried. */
  lifted: () =>
    quietly(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),

  /** A record was written. */
  saved: () =>
    quietly(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    ),

  /** A record was removed — heavier than saving, because it is not undoable. */
  removed: () =>
    quietly(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),

  /** Something was refused, or did not land. */
  failed: () =>
    quietly(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
    ),
}
