/**
 * Stage two: which note, which list, which recipe, which cheese.
 *
 * Only the targets that append to something that already exists get this far,
 * plus the one `create` that still needs somewhere to live — a task with no
 * list is a task nobody sees again. By the time anybody is here they have
 * committed to a destination, so **this stage is allowed to load**, which stage
 * one deliberately is not.
 *
 * A Module with nothing in it is still reached (ADR-0022), so this has to be
 * able to say "nothing here yet" without it reading as a refusal — the Drop is
 * still pending, Back is still the chooser, and another destination is one tap
 * away.
 *
 * Search filters what has already arrived, exactly as the collections do it, and
 * no add button hides behind an empty result (`apps/mobile/DESIGN_SYSTEM.md`).
 * Notes are the exception: only the recent ones arrive, so a search also asks
 * the server for the rest.
 *
 * The header title is set before anything else is decided, because a screen
 * reached with a stale address still has to say what it is rather than being a
 * blank page with no name and no way out.
 */

import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { api } from '../convex/api'
import { useQuery } from '../convex/queries'
import { confirmDestructive } from '../feedback/confirmDestructive'
import { haptics } from '../feedback/haptics'
import {
  type AmbientGroup,
  useGroup,
  useOpenInGroup,
} from '../group/GroupProvider'
import { fmt, useI18n } from '../i18n'
import { moduleShown } from '../modules/buildModules'
import { UI_ICONS } from '../theme/icons'
import { RADIUS, SIZE, TYPE, useTokens } from '../theme/tokens'
import { useDebouncedQuery } from '../ui/use-debounced-query'
import { useDrop } from './DropProvider'
import {
  type DropTarget,
  type DropTargetId,
  dropTargetById,
} from './dropTargets'
import { asksServer, pickableNotes } from './noteCandidates'
import { type DropPicked, useDropCommit } from './useDropCommit'

/** One row of whatever stage two is listing. */
interface Candidate extends DropPicked {
  label: string
  /** A list Gather may read but never write to (ADR-0021). */
  readOnly?: boolean
}

export function DropPickScreen() {
  const tokens = useTokens()
  const router = useRouter()
  const { t } = useI18n()
  const { group, groups } = useGroup()
  const openInGroup = useOpenInGroup()
  const { pending, clear } = useDrop()
  const commit = useDropCommit()
  const { target: targetId, groupId } = useLocalSearchParams<{
    target: DropTargetId
    groupId?: string
  }>()
  // The Group stage one named, which the candidates are listed from and the
  // save goes into — one Group for both. An address naming a Group the Member
  // is not in falls back to the one on screen.
  const named = groups.find((each) => each._id === groupId) ?? group

  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  const target = knownTarget(targetId)
  const drop = pending?.drop ?? null
  const candidates = useCandidates(target, named, query)
  const text = t.drop

  // `picks: 'none'` never reaches this screen — the chooser finishes those
  // itself — so a target that has one is as good as no target at all. Read as
  // two values so the heading below is typed by the question rather than by the
  // whole union.
  const ask = target && target.picks !== 'none' ? target.picks : null
  const asking = ask ? target : null

  async function choose(candidate: Candidate) {
    if (!asking || !drop || saving || candidate.readOnly) return

    // Replacing a photo destroys the one that is there, so it asks first and
    // names the item (`apps/mobile/DESIGN_SYSTEM.md`). Everything else here adds
    // rather than replaces, and adding never asks.
    if (candidate.hasPhoto) {
      confirmDestructive({
        title: fmt(text.replaceTitle, { name: candidate.label }),
        message: text.replaceBody,
        confirm: text.replace,
        cancel: t.common.actions.cancel,
        onConfirm: () => void save(candidate),
      })
      return
    }
    await save(candidate)
  }

  async function save(candidate: Candidate) {
    if (!asking || !drop) return
    setSaving(candidate.id)
    setFailed(false)
    try {
      const result = await commit({
        target: asking,
        drop,
        group: named,
        pick: candidate,
      })
      if (result.ok !== true) {
        haptics.actionFailed()
        setFailed(true)
        return
      }
      haptics.itemSaved()
      const { href } = result
      // Follow the Drop into the Group it named, as stage one does.
      openInGroup(named._id, () => {
        clear()
        router.dismissTo('/home')
        router.push(href)
      })
    } catch {
      // Back is still the chooser and the Drop is still pending, so recovery
      // needs nothing of its own — see the chooser's note.
      haptics.actionFailed()
      setFailed(true)
    } finally {
      setSaving(null)
    }
  }

  // Notes arrive already searched, by their body too.
  const filtered =
    ask === 'note'
      ? (candidates ?? [])
      : (candidates ?? []).filter((candidate) =>
          candidate.label.toLowerCase().includes(query.trim().toLowerCase()),
        )

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: ask ? text.pick[ask] : text.title,
        }}
      />
      <View style={[styles.root, { backgroundColor: tokens.ground }]}>
        {!asking || !drop ? (
          // A stale address, or a Drop that was answered elsewhere. Named by
          // the header above, and one Back from the chooser.
          <Text style={[styles.empty, { color: tokens.muted }]}>
            {text.pick.gone}
          </Text>
        ) : (
          <>
            <View
              style={[
                styles.search,
                { backgroundColor: tokens.surface, borderColor: tokens.hair },
              ]}
            >
              <UI_ICONS.Search size={17} color={tokens.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={text.pick.search}
                placeholderTextColor={tokens.muted}
                style={[styles.searchInput, { color: tokens.ink }]}
                autoCorrect={false}
                returnKeyType="search"
              />
            </View>

            {candidates === undefined ? (
              <LoadingSkeleton rows={5} label={t.actions.loading} />
            ) : (
              <ScrollView contentContainerStyle={styles.rows}>
                {filtered.length === 0 ? (
                  <Text style={[styles.empty, { color: tokens.muted }]}>
                    {candidates.length === 0 && !(ask === 'note' && query.trim())
                      ? text.pick.empty
                      : fmt(text.pick.noMatches, { query: query.trim() })}
                  </Text>
                ) : (
                  filtered.map((candidate) => (
                    <Pressable
                      key={candidate.id}
                      accessibilityRole="button"
                      accessibilityLabel={candidate.label}
                      accessibilityState={{
                        disabled: Boolean(candidate.readOnly),
                      }}
                      onPress={() => void choose(candidate)}
                      style={({ pressed }) => [
                        styles.row,
                        {
                          backgroundColor: tokens.surface,
                          borderColor: tokens.hair,
                        },
                        candidate.readOnly && styles.disabled,
                        pressed && !candidate.readOnly && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[styles.rowLabel, { color: tokens.ink }]}
                      >
                        {candidate.label}
                      </Text>
                      {saving === candidate.id ? (
                        <ActivityIndicator color={tokens.muted} />
                      ) : candidate.readOnly ? (
                        <Text style={[styles.rowNote, { color: tokens.muted }]}>
                          {text.pick.readOnly}
                        </Text>
                      ) : null}
                    </Pressable>
                  ))
                )}
              </ScrollView>
            )}

            {failed ? (
              <Text style={[styles.problem, { color: tokens.danger }]}>
                {text.failed}
              </Text>
            ) : null}
          </>
        )}
      </View>
    </>
  )
}

/**
 * The target an address names, or null.
 *
 * A route param is a string somebody could have typed, so an unrecognised one
 * is a screen that says so rather than a thrown error — the same reading
 * `TastingRoute` gives its `[kind]` segment. A target in a Module this build
 * hides reads as unknown too (`modules/moduleVisibility.ts`).
 */
function knownTarget(id: string | undefined): DropTarget | null {
  if (!id) return null
  try {
    const target = dropTargetById(id as DropTargetId)
    return moduleShown(target.module) ? target : null
  } catch {
    return null
  }
}

/**
 * What this target is picking from.
 *
 * Every branch subscribes unconditionally and the unused ones are skipped, so
 * the hook order never changes with the target — the rule React enforces, and
 * the reason this is one hook rather than four screens.
 */
function useCandidates(
  target: DropTarget | null,
  group: AmbientGroup,
  query: string,
): Candidate[] | undefined {
  const groupSlug = group.slug
  const picks = target?.picks

  const recentNotes = useQuery(
    api.notes.picker,
    picks === 'note' ? { groupSlug } : 'skip',
  )
  const debounced = useDebouncedQuery(query).trim()
  const foundNotes = useQuery(
    api.notes.searchNotes,
    picks === 'note' &&
      debounced === query.trim() &&
      asksServer(debounced)
      ? { groupSlug, query: debounced }
      : 'skip',
  )
  const lists = useQuery(
    api.taskLists.list,
    picks === 'task-list' || picks === 'grocery-list' ? { groupSlug } : 'skip',
  )
  const recipes = useQuery(
    api.recipes.list,
    picks === 'recipe' ? { groupSlug } : 'skip',
  )
  const subjects = useQuery(
    api.tastings.listByKind,
    picks === 'tasting-subject' && target?.tastingKind
      ? { groupSlug, kind: target.tastingKind }
      : 'skip',
  )
  const { t } = useI18n()

  if (picks === 'note') {
    return pickableNotes(
      query,
      recentNotes,
      foundNotes,
      t.notes.untitled,
    )?.map((note) => ({
      id: note._id,
      label: note.title || t.notes.untitled,
      // Carried so the commit appends to what is on screen rather than reading
      // the note back to learn what somebody just pointed at.
      body: note.body,
    }))
  }
  if (picks === 'task-list') {
    return lists?.map((list) => ({
      id: list._id,
      label: list.name,
      readOnly: !list.writable,
    }))
  }
  if (picks === 'grocery-list') {
    return lists
      ?.filter((list) => list.grocery)
      .map((list) => ({
        id: list._id,
        label: list.name,
        readOnly: !list.writable,
      }))
  }
  if (picks === 'recipe') {
    return recipes?.map((recipe) => ({
      id: recipe._id,
      label: recipe.title,
      hasPhoto: Boolean(recipe.imageUrl),
    }))
  }
  if (picks === 'tasting-subject') {
    return subjects?.map((subject) => ({
      id: subject._id,
      label: subject.name,
      name: subject.name,
      hasPhoto: Boolean(subject.photoUrl),
    }))
  }
  return []
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 16, gap: 12 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: RADIUS.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    minHeight: SIZE.hitMin,
  },
  searchInput: { ...TYPE.body, flex: 1 },
  rows: { gap: 8, paddingBottom: 32 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: RADIUS.card,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rowLabel: { ...TYPE.body, flexShrink: 1 },
  rowNote: { ...TYPE.footnote },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.75 },
  empty: { ...TYPE.subhead, paddingVertical: 24, textAlign: 'center' },
  problem: { ...TYPE.subhead },
})
