/**
 * `<scheme>://quick`: Home with the quick-actions sheet open (APP-206), the
 * target of APP-207's iOS quick action and Control Center control.
 *
 * Outside `(app)`, like the `/g/…` capture, because the link may arrive signed
 * out: the request is held (`quickSheetRequest.ts`) and Home is where it goes.
 * Signed out, `(app)` sends Home to sign-in, which lands on Home afterwards,
 * and the tabs then take the request and open the sheet.
 *
 * `?action=task-new` (APP-207's "Add task" quick action) opens the sheet with
 * that action's form expanded; any other value opens the plain sheet.
 */
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect } from 'react'

import {
  quickSheetAction,
  requestQuickSheet,
} from '../src/shell/quickSheetRequest'

export default function QuickSheetLink() {
  const { action } = useLocalSearchParams<{ action?: string }>()

  useEffect(() => {
    requestQuickSheet({ action: quickSheetAction(action) })
    // Back to the Home already under this screen, not a second copy of it.
    router.dismissTo('/home')
  }, [action])

  return null
}
