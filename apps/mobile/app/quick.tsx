/**
 * `<scheme>://quick`: Home with the quick-actions sheet open (APP-206), the
 * target of APP-207's iOS quick action and Control Center control.
 *
 * Outside `(app)`, like the `/g/…` capture, because the link may arrive signed
 * out: the request is held (`quickSheetRequest.ts`) and Home is where it goes.
 * Signed out, `(app)` sends Home to sign-in, which lands on Home afterwards,
 * and the tabs then take the request and open the sheet.
 */
import { router } from 'expo-router'
import { useEffect } from 'react'

import { requestQuickSheet } from '../src/shell/quickSheetRequest'

export default function QuickSheetLink() {
  useEffect(() => {
    requestQuickSheet()
    router.replace('/home')
  }, [])

  return null
}
