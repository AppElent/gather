/**
 * A sheet form's draft, kept when a share closes the sheet (APP-622).
 *
 * A share from another app closes every open sheet before it shows the Drop
 * chooser (APP-618, `components/openSheets.ts`). The person did not ask for
 * that, so what they had typed is kept, in the composer draft store
 * (`ui/composer-drafts.ts`): per account, Group and place, in memory only. The
 * form opens on it next time ([editors](../../../../docs/standards/editors.md)).
 *
 * Only a share keeps it. A close the person chose (Cancel, Close, a swipe) or
 * a save forgets it, as those already do. Nothing is kept while a save is on
 * its way: reopened, it could be sent twice. If that save then fails, the form
 * says so with `failed`, which keeps it.
 *
 * Usage, in the component that holds the form's state:
 *
 *     const draft = useSheetDraft<Draft>(`tasks:new-list`)
 *     const [name, setName] = useState(draft.kept?.name ?? '')
 *     draft.track({ name }, { holding: busy })
 */
import { useAuth } from '@clerk/expo'
import { useEffect, useRef, useState } from 'react'

import { onSheetsClosing } from '../components/openSheets'
import { useGroup } from '../group/GroupProvider'
import { draftKey, keepDraft, keptDraft } from './composer-drafts'

export interface TrackOptions {
  /** A save is on its way: nothing is kept. */
  holding?: boolean
  /**
   * Whether there is anything worth keeping. By default, whether the value
   * differs from the first one tracked; a form opened on a kept draft is
   * dirty until it is saved or closed.
   */
  dirty?: boolean
}

export interface SheetDraft<T> {
  /** The draft a share kept, read when the form opened. */
  kept: T | undefined
  /** The form's state now, called on every render. Serialisable values only. */
  track: (value: T, options?: TrackOptions) => void
  /**
   * The save failed. Keeps the draft when a share closed the form meanwhile,
   * unless a reopened form kept a newer one; `value` when only part is left.
   */
  failed: (value?: T) => void
}

interface Tracked<T> {
  value: T
  dirty: boolean
  holding: boolean
}

export function useSheetDraft<T>(place: string): SheetDraft<T> {
  const { userId } = useAuth()
  const { group } = useGroup()
  // Fixed for the form's life: a Group change remounts the forms that care.
  const [key] = useState(() => draftKey(userId, group._id, place))
  const [kept] = useState(() => keptDraft<T>(key))
  // The first value tracked, as JSON; `null` once opened on a kept draft.
  const baseline = useRef<string | null | undefined>(
    kept === undefined ? undefined : null,
  )
  const latest = useRef<Tracked<T> | null>(null)
  const closedByShare = useRef(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    const keep = () => {
      const now = latest.current
      keepDraft(key, now?.dirty && !now.holding ? now.value : undefined)
    }
    const stop = onSheetsClosing(() => {
      closedByShare.current = true
      keep()
    })
    return () => {
      stop()
      mounted.current = false
      // A share: keep what is there as the form closes. Anything else is a
      // close the person chose, or a save, and forgets it.
      if (closedByShare.current) keep()
      else keepDraft(key, undefined)
    }
  }, [key])

  // Plain object, made each render: the hook's state is all in refs.
  return {
    kept,
    track(value, options = {}) {
      let dirty = options.dirty
      if (dirty === undefined) {
        const json = JSON.stringify(value)
        if (baseline.current === undefined) baseline.current = json
        dirty = baseline.current === null || json !== baseline.current
      }
      latest.current = { value, dirty, holding: options.holding ?? false }
    },
    failed(value) {
      if (mounted.current || !closedByShare.current || !latest.current) return
      if (keptDraft<T>(key) === undefined)
        keepDraft(key, value ?? latest.current.value)
    },
  }
}

/**
 * For a sheet whose form state the screen under it holds (the finance
 * screens): that state outlives the sheet, but opening the sheet seeds it
 * again. `open` is what the sheet is open on (a field, `true`, a name), or
 * nothing while it is closed.
 *
 * The returned `resume()` gives, once, what the sheet was open on when a
 * share closed it; the screen opens it on that without seeding, on what was
 * typed. Every open asks it, so the answer never outlives the next open. Kept
 * for the screen's life, in memory only: a Group switch that unwinds the
 * screen loses it. `landed` counts the screen's successful saves: one that
 * lands after the close makes the kept input old, so the next open seeds.
 */
export function useSheetResume<T>(
  open: T | null | undefined | false,
  landed?: { readonly current: number },
): () => T | undefined {
  const current = useRef(open)
  current.current = open
  const shared = useRef<T | undefined>(undefined)
  const landedThen = useRef(0)

  useEffect(
    () =>
      onSheetsClosing(() => {
        const now = current.current
        // Told once per sheet: a later one must not forget this screen's, which
        // may have closed by then.
        if (now === null || now === undefined || now === false) return
        landedThen.current = landed?.current ?? 0
        shared.current = now
      }),
    [landed],
  )

  const [resume] = useState(() => () => {
    const was = shared.current
    shared.current = undefined
    return (landed?.current ?? 0) === landedThen.current ? was : undefined
  })
  return resume
}
