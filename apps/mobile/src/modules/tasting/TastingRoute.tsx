/**
 * The door every tasting route comes through.
 *
 * Six route files — three screens under each of two tabs (ADR-0023) — and one
 * of these behind all of them, so a screen is written once and the route file
 * says only which tab it is mounted in and which screen it is.
 *
 * **The `[kind]` segment is validated here and nowhere else.** An unrecognised
 * segment is a redirect, never a default: falling back to cheese would make a
 * typo, or a stale deep link, silently show somebody another Module's
 * contents. The backend refuses a mismatched Kind too — `getSubject` answers
 * "not found" for a cheese asked for as a wine — so a bad address fails at
 * both ends rather than at neither.
 *
 * Params arrive as strings because that is all a route can carry; the screens
 * take them as strings and hand them to Convex, which types them at its own
 * door.
 */
import { Redirect, useLocalSearchParams } from 'expo-router'

import { type ComposerMode, ComposerScreen } from './ComposerScreen'
import { IndexScreen } from './IndexScreen'
import { TASTING_BASES, type TastingTab, tastingKindFromRoute } from './paths'
import { SubjectScreen } from './SubjectScreen'

const MODES: ComposerMode[] = ['new', 'tasting', 'subject']

export function TastingRoute({
  tab,
  screen,
}: {
  tab: TastingTab
  screen: 'index' | 'subject' | 'compose'
}) {
  const params = useLocalSearchParams<{
    kind?: string
    subjectId?: string
    tastingId?: string
    mode?: string
    name?: string
    catalogKey?: string
  }>()

  const kind = tastingKindFromRoute(params.kind)
  const base = TASTING_BASES[tab]
  if (!kind) return <Redirect href="/all" />

  if (screen === 'index') return <IndexScreen base={base} kind={kind} />

  if (screen === 'subject') {
    // A subject screen with no subject is not a screen. Back to the index,
    // which is the parent this page's Back button points at anyway.
    if (!params.subjectId) {
      return <Redirect href={`${base}/${kind}` as never} />
    }
    return (
      <SubjectScreen base={base} kind={kind} subjectId={params.subjectId} />
    )
  }

  const mode = MODES.find((candidate) => candidate === params.mode) ?? 'new'
  return (
    <ComposerScreen
      kind={kind}
      mode={mode}
      subjectId={params.subjectId}
      tastingId={params.tastingId}
      name={params.name}
      catalogKey={params.catalogKey}
    />
  )
}
