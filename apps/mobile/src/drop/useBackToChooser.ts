/**
 * Back from a screen that kept the Drop goes to the chooser (APP-972).
 *
 * A `keepsDrop` target opens in its tab, over the tab's root (`withAnchor`), so
 * reselecting the tab pops to that root as it does anywhere else (APP-963). The
 * chooser lives above the tabs, so that push lands as a second tab layout over
 * it, and plain Back would stop at the tab's root with the Drop still pending
 * and the chooser hidden underneath. This hook turns Back — the header button,
 * the swipe, the Android back button — into a pop down to the chooser, with the
 * same Drop still there to put somewhere else.
 *
 * A reselect of the tab is still a pop to its root. Natively it is the same pop
 * as Back, so the tab's own `tabPress`, which arrives first, marks it and that
 * one is let through. Checked on iOS; on Android the native pop may reach JS
 * before `tabPress`, and a reselect would then land on the chooser instead.
 *
 * The returned `leave()` lifts the guard and goes down to the chooser in one
 * step, for the screen's own save: from there `/home` is the tabs under the
 * chooser, not the second tab layout, so nothing is left over the new record.
 */
import { useNavigation, usePreventRemove, useRouter } from 'expo-router'
import { useEffect, useRef } from 'react'

import { dropHref } from './paths'

interface TabNavigation {
  addListener: (event: 'tabPress', listener: () => void) => () => void
}

interface ScreenNavigation {
  isFocused: () => boolean
  getParent: () => TabNavigation | undefined
}

export function useBackToChooser(active: boolean): () => void {
  const router = useRouter()
  const navigation = useNavigation() as unknown as ScreenNavigation
  const reselected = useRef(false)

  // The screen's parent is its tab's route in the tab navigator, which is
  // where that tab's `tabPress` lands. While this screen is focused, a press
  // of its own tab is a reselect.
  useEffect(() => {
    if (!active) return
    return navigation.getParent()?.addListener('tabPress', () => {
      if (navigation.isFocused()) reselected.current = true
    })
  }, [active, navigation])

  const disablePrevention = usePreventRemove(active, ({ repeat }) => {
    if (reselected.current) {
      reselected.current = false
      repeat()
      return
    }
    leave()
  })

  function leave() {
    disablePrevention()
    router.dismissTo(dropHref())
  }
  return leave
}
