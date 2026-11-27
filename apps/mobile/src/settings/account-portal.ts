import { ACCOUNT_PORTAL_URL } from '@gather/core/account-portal'

import { openWebPage } from '../feedback/openWebPage'
import type { Messages } from '../i18n'

/** Opens the AppElent account portal in the in-app browser. */
export function openAccountPortal(t: Messages) {
  return openWebPage(ACCOUNT_PORTAL_URL, t.account.portal.failed)
}
