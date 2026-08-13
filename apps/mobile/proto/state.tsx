/**
 * PROTOTYPE (#146) — throwaway. In-memory only: no Convex, no persistence.
 *
 * Holds the two things the shell has to react to at runtime — which Group you
 * are in (#145: ambient, not addressed) and which Modules you have pinned
 * (ADR-0005) — so every variant reads the same state and a switch is visible
 * everywhere at once.
 */
import { createContext, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { DEFAULT_PINS, GROUPS } from './catalog'

export type Variant = 'a' | 'b' | 'd' | 'f'

/**
 * How visible the current Group is on a screen that is not Home.
 *
 * `none` — #145 as decided: Home names it, nothing else does.
 * `content` — a line inside the screen body, which costs no native chrome.
 * `strip` — a drawn Group line above a drawn header, replacing the native one.
 */
export type GroupChrome = 'none' | 'content' | 'strip'

export const GROUP_CHROME_ORDER: GroupChrome[] = ['none', 'content', 'strip']

interface ProtoState {
  groupChrome: GroupChrome
  cycleGroupChrome: () => void
  groupSlug: string
  groupName: string
  setGroup: (slug: string) => void
  /** Bumped on every Group switch — the prototype's stand-in for "reset every tab to its root". */
  groupEpoch: number
  pins: string[]
  togglePin: (id: string) => void
  isPinned: (id: string) => boolean
}

const Ctx = createContext<ProtoState | null>(null)

export function ProtoProvider({ children }: { children: ReactNode }) {
  const [groupSlug, setGroupSlug] = useState(GROUPS[0].slug)
  const [groupEpoch, setGroupEpoch] = useState(0)
  const [pins, setPins] = useState<string[]>(DEFAULT_PINS)
  const [groupChrome, setGroupChrome] = useState<GroupChrome>('none')

  const value = useMemo<ProtoState>(
    () => ({
      groupChrome,
      cycleGroupChrome: () =>
        setGroupChrome(
          (current) =>
            GROUP_CHROME_ORDER[
              (GROUP_CHROME_ORDER.indexOf(current) + 1) %
                GROUP_CHROME_ORDER.length
            ],
        ),
      groupSlug,
      groupName: GROUPS.find((g) => g.slug === groupSlug)?.name ?? '',
      setGroup: (slug) => {
        setGroupSlug(slug)
        setGroupEpoch((n) => n + 1)
      },
      groupEpoch,
      pins,
      togglePin: (id) =>
        setPins((current) =>
          current.includes(id)
            ? current.filter((p) => p !== id)
            : [...current, id],
        ),
      isPinned: (id) => pins.includes(id),
    }),
    [groupSlug, groupEpoch, pins, groupChrome],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useProto() {
  const value = useContext(Ctx)
  if (!value) throw new Error('useProto outside ProtoProvider')
  return value
}

/** The three Modules variant B and D nail to the bar. `DEFAULT_PINS`, in order. */
export const FIXED_TABS = DEFAULT_PINS

export function moduleHref(
  variant: Variant,
  id: string,
  from: 'home' | 'all',
): string {
  if ((variant === 'b' || variant === 'd') && FIXED_TABS.includes(id)) {
    return `/${variant}/${id}`
  }
  if (variant === 'f') return `/f/m/${id}`
  return `/${variant}/${from}/m/${id}`
}

export function homeHref(variant: Variant) {
  return variant === 'f' ? '/f' : `/${variant}/home`
}

export function allHref(variant: Variant) {
  return variant === 'f' ? '/f/all' : `/${variant}/all`
}

/**
 * The switcher and the shell's own pages live *above* every variant, at the
 * root stack — Settings, Account and Groups belong to no Group, and the
 * switcher is a sheet over whatever you were looking at. One implementation
 * serves all four variants; the variant travels as a search param because
 * these routes sit outside the segment `useVariant` reads.
 */
export function switchGroupHref(variant: Variant) {
  return `/switch-group?v=${variant}`
}

export const YOU_HREF = '/you'
