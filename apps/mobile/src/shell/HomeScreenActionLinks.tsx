/**
 * Draws nothing. Keeps the app icon's long-press menu (`homeScreenActions.ts`)
 * in the current language, and follows a chosen item, or the Control Center
 * control's request (`controlRequest.ts`), to the quick-actions sheet.
 *
 * Mounted by the root navigator once the router is up, signed in or not: the
 * route holds the request across sign-in, as it does for the deep link.
 */
import * as QuickActions from 'expo-quick-actions'
import { router } from 'expo-router'
import { useEffect } from 'react'
import { Platform, Settings } from 'react-native'

import { useI18n } from '../i18n'
import { reportError } from '../observability/report'
import { CONTROL_REQUEST_KEY, isFreshControlRequest } from './controlRequest'
import {
  homeScreenActionItems,
  homeScreenActionRequest,
} from './homeScreenActions'
import {
  type QuickSheetRequest,
  quickSheetHref,
  requestQuickSheetInPlace,
} from './quickSheetRequest'

/**
 * `QuickActions.initial` is the item that launched this process and never
 * clears, so it is followed once per process, not once per mount: the
 * navigator remounts this after the Unavailable gate.
 */
let launchItemFollowed = false

/** Opens the sheet in place when it is up, else through its route. */
function openQuickSheet(request: QuickSheetRequest) {
  if (requestQuickSheetInPlace(request)) return
  // A tick later, so a cold start's router has mounted its first screen.
  setTimeout(() => router.navigate(quickSheetHref(request)))
}

export function HomeScreenActionLinks() {
  const { t } = useI18n()

  useEffect(() => {
    QuickActions.setItems(homeScreenActionItems(t)).catch(reportError)
  }, [t])

  useEffect(() => {
    const follow = (action: QuickActions.Action) => {
      const request = homeScreenActionRequest(action.id)
      if (request) openQuickSheet(request)
    }
    if (!launchItemFollowed) {
      launchItemFollowed = true
      if (QuickActions.initial) follow(QuickActions.initial)
    }
    const subscription = QuickActions.addListener(follow)
    return () => subscription.remove()
  }, [])

  // The control's request: one left before this mounted (a cold start), then
  // each new one. Taken once: cleared before the sheet opens.
  useEffect(() => {
    if (Platform.OS !== 'ios') return
    const take = () => {
      const requestedAt = Settings.get(CONTROL_REQUEST_KEY)
      if (requestedAt == null) return
      Settings.set({ [CONTROL_REQUEST_KEY]: null })
      if (isFreshControlRequest(requestedAt, Date.now())) openQuickSheet({})
    }
    take()
    const watch = Settings.watchKeys(CONTROL_REQUEST_KEY, take)
    return () => Settings.clearWatch(watch)
  }, [])

  return null
}
