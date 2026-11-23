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
  /**
   * A share closed the form and it is gone: a save landing now must not close
   * or navigate, which would act on whatever has opened since.
   */
  gone: () => boolean
  /** A share is closing the form: a form that saves on close must not. */
  sharing: () => boolean
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
    sharing: () => closedByShare.current,
    gone: () => closedByShare.current && !mounted.current,
  }
}

/** A screen's guarded writes, as `useSheetResume` needs them. */
export interface SheetWrites {
  /** Calls `listener` as each save starts. Returns the unsubscribe. */
  onStart: (listener: () => void) => () => void
  /** Calls `listener` once, when the save on its way settles. */
  onSettled: (listener: (landed: boolean) => void) => void
}

interface ResumeOptions<O, V> {
  /** Where the sheet is, the record's id included. */
  place: string
  /** What the sheet is open on (a field, `true`), or nothing while closed. */
  open: O | null | undefined | false
  /** What the sheet's fields hold now. Serialisable values only. */
  values: V
  /** Puts kept values back in the fields. */
  restore: (values: V) => void
  writes?: SheetWrites
}

/**
 * For a sheet whose form state the screen under it holds (the finance
 * screens): opening the sheet seeds that state again, so what a share closed
 * is kept in the draft store, per account, Group, place and what the sheet was
 * open on.
 *
 * The returned `resume(want)` puts the kept values back and answers `true`, or
 * `false` when there are none and the screen seeds. What this sheet already
 * sent, unchanged since, is kept only if that save fails; another sheet's save
 * on the same screen does not count.
 */
export function useSheetResume<O, V>({
  place,
  open,
  values,
  restore,
  writes,
}: ResumeOptions<O, V>): (want: O) => boolean {
  const { userId } = useAuth()
  const { group } = useGroup()
  const keyFor = (on: unknown) =>
    draftKey(userId, group._id, `${place}:${on === true ? 'open' : on}`)
  const key =
    open === null || open === undefined || open === false ? null : keyFor(open)

  const json = JSON.stringify(values)
  const opened = useRef<{ key: string; baseline: string | null } | null>(null)
  // The key `resume` last put back: the sheet that opens on it is dirty.
  const restored = useRef<string | null>(null)
  if (key === null) opened.current = null
  else if (opened.current?.key !== key) {
    opened.current = { key, baseline: restored.current === key ? null : json }
    restored.current = null
  }

  const latest = useRef({ json, values, writes })
  latest.current = { json, values, writes }

  // What the open sheet sent, until that save settles.
  const sent = useRef<{ sheet: unknown; json: string } | null>(null)
  useEffect(
    () =>
      writes?.onStart(() => {
        const sheet = opened.current
        if (!sheet) return
        const mine = { sheet, json: latest.current.json }
        sent.current = mine
        // An earlier save's failure may have kept its values under this open
        // sheet; once this one lands, they are out of date. One kept since
        // the save started is newer, and stays.
        const older = keptDraft<V>(sheet.key)
        writes.onSettled((landed) => {
          if (sent.current === mine) sent.current = null
          if (landed && older !== undefined && keptDraft(sheet.key) === older)
            keepDraft(sheet.key, undefined)
        })
      }),
    [writes],
  )

  useEffect(
    () =>
      onSheetsClosing(() => {
        const sheet = opened.current
        const now = latest.current
        if (!sheet || sheet.baseline === now.json) return
        const waiting =
          sent.current?.sheet === sheet && sent.current.json === now.json
        if (!now.writes || !waiting) {
          keepDraft(sheet.key, now.values)
          return
        }
        // Sent already. Only a failure leaves it worth keeping, and the screen
        // may be gone by then; a newer draft stays.
        now.writes.onSettled((landed) => {
          if (!landed && keptDraft<V>(sheet.key) === undefined)
            keepDraft(sheet.key, now.values)
        })
      }),
    [],
  )

  return (want) => {
    const wanted = keyFor(want)
    const kept = keptDraft<V>(wanted)
    if (kept === undefined) return false
    keepDraft(wanted, undefined)
    restored.current = wanted
    restore(kept)
    return true
  }
}
