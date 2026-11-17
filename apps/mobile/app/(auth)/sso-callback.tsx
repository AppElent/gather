/**
 * Where the provider's browser lands: `<scheme>://sso-callback` (APP-208).
 *
 * `useSSO()` reads that URL from the auth session and finishes the sign-in
 * itself, so this screen has nothing to do. It exists because on Android the
 * same deep link also reaches expo-router, which would otherwise show
 * "Unmatched route". It steps back to the screen that started the flow (or the
 * welcome screen on a cold start); once the session is active, the `(auth)`
 * layout redirects into the app as usual.
 */
import { Redirect, useRouter } from 'expo-router'
import { useEffect } from 'react'

export default function SsoCallback() {
  const router = useRouter()
  const canGoBack = router.canGoBack()

  useEffect(() => {
    if (canGoBack) router.back()
  }, [canGoBack, router])

  return canGoBack ? null : <Redirect href="/" />
}
