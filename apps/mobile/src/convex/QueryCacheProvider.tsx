/**
 * Retention for every query the phone reads through `queries.ts`: the
 * `QueryCacheProvider` of the standard's `retention` starter.
 *
 * `ConvexSessionGate` mounts it once it has confirmed the account, keyed by
 * it, so sign-out or an account switch drops every retained subscription with
 * the tree. Backgrounding releases the idle ones and stops retaining until the
 * app is in front again; mounted subscriptions carry on.
 *
 * A Group switch releases nothing. Every Group read names its Group in its
 * arguments (`groupSlug`; ADR-0031: no server-side default picks the Group),
 * and the reads without one are the account's own (`users.me`,
 * `groups.myGroups`, the Catalog). So the previous Group's subscriptions are
 * different keys that cannot answer for the new one, the person is entitled
 * to both, and they idle out within the same bounds. Switching back inside
 * the expiration is then as instant as a tab return. Keying by Group would
 * also have to remount everything below the provider, `GroupProvider`
 * included, on every switch.
 *
 * `CacheLifecycle` reaches into the helper's registry (`queries`, `subs`,
 * `idle`, `timeout`, `maxIdleEntries`); verify those still exist when
 * upgrading `convex-helpers`.
 */
import { useConvexAuth } from 'convex/react'
import { ConvexQueryCacheProvider } from 'convex-helpers/react/cache'
import { ConvexQueryCacheContext } from 'convex-helpers/react/cache/provider'
import { type ReactNode, useContext, useEffect } from 'react'
import { AppState } from 'react-native'

import { EXPIRATION_MS, MAX_IDLE_ENTRIES } from './queries'

function CacheLifecycle({ children }: { children: ReactNode }) {
  const { registry } = useContext(ConvexQueryCacheContext)
  useEffect(() => {
    if (!registry) return
    const release = (all: boolean) => {
      for (const [key, entry] of registry.queries) {
        if (!all && entry.refs.size !== 0) continue
        if (entry.evictTimer !== null) clearTimeout(entry.evictTimer)
        entry.unsub()
        registry.queries.delete(key)
      }
      registry.idle = 0
      if (all) registry.subs.clear()
    }
    const update = (state: string) => {
      const foreground = state === 'active'
      registry.timeout = foreground ? EXPIRATION_MS : 0
      registry.maxIdleEntries = foreground ? MAX_IDLE_ENTRIES : 0
      if (!foreground) release(false)
    }
    update(AppState.currentState)
    const listener = AppState.addEventListener('change', update)
    return () => {
      listener.remove()
      registry.timeout = 0
      registry.maxIdleEntries = 0
      release(true)
    }
  }, [registry])
  return children
}

/** A live backend identity must match the locally selected account. */
export function useAccountReady(
  account: string | null | undefined,
  confirmedAccount: string | null | undefined,
) {
  const { isAuthenticated } = useConvexAuth()
  return (
    typeof account === 'string' &&
    isAuthenticated &&
    confirmedAccount === account
  )
}

/** Mount below the auth gate. Account changes disable queries until backend
 * confirmation. */
export function QueryCacheProvider({
  account,
  confirmedAccount,
  fallback,
  children,
}: {
  account: string
  /** The live backend's answer to who is signed in, never a cached or local
   * identity. */
  confirmedAccount: string | null | undefined
  /** Drawn while the identities do not match. */
  fallback: ReactNode
  children: ReactNode
}) {
  const ready = useAccountReady(account, confirmedAccount)
  if (!ready) return fallback
  return (
    <ConvexQueryCacheProvider
      key={account}
      expiration={EXPIRATION_MS}
      maxIdleEntries={MAX_IDLE_ENTRIES}
    >
      <CacheLifecycle>{children}</CacheLifecycle>
    </ConvexQueryCacheProvider>
  )
}
