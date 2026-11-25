import { ACCOUNT_PORTAL_URL } from '@gather/core/account-portal'

import type { Messages } from '../i18n'
import {
  openBrowserAsync,
  showAlert,
} from '../observability/native-presentation'

let opening = false

/**
 * Opens the AppElent account portal in the in-app browser, and says so when no
 * browser can open it. A second tap while it is opening does nothing: iOS
 * refuses a second browser, which would read as a failure.
 */
export async function openAccountPortal(t: Messages) {
  if (opening) return
  opening = true
  try {
    await openBrowserAsync(ACCOUNT_PORTAL_URL)
  } catch {
    showAlert(t.account.portal.failed)
  } finally {
    opening = false
  }
}
