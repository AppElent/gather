/**
 * Every link the system hands the app passes here before the router reads it.
 *
 * One is not an address: the iOS share extension opens the app with
 * `<scheme>://dataUrl=<scheme>ShareKey…` to say a share is waiting.
 * `expo-share-intent` reads the share from it (`DropProvider`), but the router
 * would also treat it as a route, find none, and show "Unmatched Route" in
 * place of the signed-in tree, unmounting the `DropGate` that opens the
 * chooser. So the router skips it: a running app stays where it is, and one it
 * launched starts at its first screen. Every other link goes on unchanged.
 */
import { getShareExtensionKey } from 'expo-share-intent'

export function redirectSystemPath({
  path,
  initial,
}: {
  path: string
  initial: boolean
}) {
  if (!path.includes(`dataUrl=${getShareExtensionKey()}`)) return path
  return initial ? '/' : null
}
