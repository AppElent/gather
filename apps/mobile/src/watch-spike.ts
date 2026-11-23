/**
 * SPIKE (APP-652, do not merge): `<scheme>://watch-spike?key=…&site=…` hands a
 * dummy device key and the Convex site URL to the watch through
 * WatchConnectivity. The real pairing (APP-658) asks Convex for the key.
 */
import * as Linking from 'expo-linking'
import { updateWatchContext, watchState } from '../modules/watch-connectivity'

function handle(url: string | null) {
  if (!url?.includes('watch-spike')) return
  const { queryParams } = Linking.parse(url)
  const key = queryParams?.key
  const site = queryParams?.site
  if (typeof key !== 'string' || typeof site !== 'string') return
  updateWatchContext({ deviceKey: key, siteUrl: site, sentAt: String(Date.now()) })
    .then(() => console.log('[watch-spike] sent', JSON.stringify(watchState())))
    .catch((error) => console.warn('[watch-spike] failed', error))
}

Linking.getInitialURL().then(handle)
Linking.addEventListener('url', ({ url }) => handle(url))
