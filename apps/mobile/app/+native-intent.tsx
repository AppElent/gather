/**
 * Every link the system hands the app passes here before the router reads it.
 *
 * Two are not addresses:
 *
 * - The iOS share extension opens the app with
 *   `<scheme>://dataUrl=<scheme>ShareKey…` to say a share is waiting.
 *   `expo-share-intent` reads the share from it (`DropProvider`), but the
 *   router would also treat it as a route, find none, and show "Unmatched
 *   Route" in place of the signed-in tree, unmounting the `DropGate` that opens
 *   the chooser. So the router skips it: a running app stays where it is, and
 *   one it launched starts at its first screen.
 * - An old `gather://g/<slug>/…` link (ADR-0015, superseded by ADR-0031). The
 *   web answers `/g/…` with not-found and nothing produces these links any
 *   more, so the phone no longer reads a Group or a screen from one (APP-81):
 *   it opens at `/`, which is Home for a signed-in person and the welcome
 *   screen otherwise, and the current Group stays as it was.
 *
 * Every other link goes on unchanged, but one that reaches a running app waits
 * until the sheets over the screen have closed (`linkAfterSheets`, APP-747). A
 * share does not wait here: `DropGate` closes the sheets before the chooser.
 */
import { getShareExtensionKey } from 'expo-share-intent'

import { dropHeldLink, linkAfterSheets } from '../src/shell/linkAfterSheets'
import { isOldGroupLink } from '../src/shell/oldGroupLink'

export function redirectSystemPath({
  path,
  initial,
}: {
  path: string
  initial: boolean
}) {
  if (path.includes(`dataUrl=${getShareExtensionKey()}`)) {
    dropHeldLink()
    return initial ? '/' : null
  }
  const address = isOldGroupLink(path) ? '/' : path
  return initial ? address : linkAfterSheets(address)
}
