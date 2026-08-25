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
 * Search filters what has already arrived, exactly as the collections do it: no
 * second query, and no add button hiding behind an empty result
 * (`docs/mobile-interaction.md`).
 *
 * The header title is set before anything else is decided, because a screen
 * reached with a stale address still has to say what it is rather than being a
 * blank page with no name and no way out.
 */
import { useQuery } from 'convex/react'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { api } from '../../../../convex/_generated/api'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { haptics } from '../feedback/haptics'
import { useGroup } from '../group/GroupProvider'
import { fmt, useI18n } from '../i18n'
import { UI_ICONS } from '../theme/icons'
import { RADIUS, useTokens } from '../theme/tokens'
import { useDrop } from './DropProvider'
import {
  type DropTarget,
  type DropTargetId,
  dropTargetById,
} from './dropTargets'
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
  const { group } = useGroup()
  const { pending, clear } = useDrop()
  const commit = useDropCommit()
  const { target: targetId, groupSlug: namedGroup } = useLocalSearchParams<{
    target: DropTargetId
    groupSlug?: string
  }>()

  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  const target = knownTarget(targetId)
  const drop = pending?.drop ?? null
  const candidates = useCandidates(target)
  const text = t.drop

  // `picks: 'none'` never reaches this screen — the chooser finishes those
  // itself — so a target that has one is as good as no target at all. Read as
  // two values so the heading below is typed by the question rather than by the
  // whole union.
  const ask = target && target.picks !== 'none' ? target.picks : null
  const asking = ask ? target : null
  const groupSlug = namedGroup || group.slug

  async function choose(candidate: Candidate) {
    if (!asking || !drop || saving || candidate.readOnly) return

    // Replacing a photo destroys the one that is there, so it asks first and
    // names the item (`docs/mobile-interaction.md`). Everything else here adds
    // rather than replaces, and adding never asks.
    if (candidate.hasPhoto) {
      Alert.alert(
        fmt(text.replaceTitle, { name: candidate.label }),
        text.replaceBody,
        [
          { text: t.actions.cancel, style: 'cancel' },
          {
            text: text.replace,
            style: 'destructive',
            onPress: () => void save(candidate),
          },
        ],
      )
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
        groupSlug,
        pick: candidate,
      })
      if (!result.ok) {
        haptics.actionFailed()
        setFailed(true)
        return
      }
      haptics.itemSaved()
      clear()
      router.dismissTo('/home')
      router.push(result.href)
    } catch {
      // Back is still the chooser and the Drop is still pending, so recovery
      // needs nothing of its own — see the chooser's note.
      haptics.actionFailed()
      setFailed(true)
    } finally {
      setSaving(null)
    }
  }

  const filtered = (candidates ?? []).filter((candidate) =>
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
      <View style={[styles.root, { backgroundColor: tokens.bg }]}>
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
                { backgroundColor: tokens.surface, borderColor: tokens.border },
              ]}
            >
              <UI_ICONS.Search size={17} color={tokens.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={text.pick.search}
                placeholderTextColor={tokens.muted}
                style={[styles.searchInput, { color: tokens.fg }]}
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
                    {candidates.length === 0
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
                          borderColor: tokens.border,
                        },
                        candidate.readOnly && styles.disabled,
                        pressed && !candidate.readOnly && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[styles.rowLabel, { color: tokens.fg }]}
                        numberOfLines={1}
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
 * `TastingRoute` gives its `[kind]` segment.
 */
function knownTarget(id: string | undefined): DropTarget | null {
  if (!id) return null
  try {
    return dropTargetById(id as DropTargetId)
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
function useCandidates(target: DropTarget | null): Candidate[] | undefined {
  const { group } = useGroup()
  const groupSlug = group.slug
  const picks = target?.picks

  const notes = useQuery(
    api.notes.list,
    picks === 'note' ? { groupSlug } : 'skip',
  )
  const lists = useQuery(
    api.taskLists.list,
    picks === 'task-list' ? { groupSlug } : 'skip',
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
    return notes?.map((note) => ({
      id: note._id,
      label: note.title || t.labs.notes.untitled,
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
    borderRadius: RADIUS.control,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: { flex: 1, fontSize: 16 },
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
  rowLabel: { fontSize: 16, flexShrink: 1 },
  rowNote: { fontSize: 13 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.75 },
  empty: { fontSize: 15, paddingVertical: 24, textAlign: 'center' },
  problem: { fontSize: 14, lineHeight: 20 },
})
