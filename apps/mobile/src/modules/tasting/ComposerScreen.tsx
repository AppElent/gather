/**
 * The composer: a subject's facts above the rule, one person's tasting below.
 *
 * ## Why a pushed screen and not a deeper sheet
 *
 * Score, date, four scales, a chip row of aromas and a notes box do not fit
 * above a keyboard. The subject step *is* a sheet, because searching a list is
 * what a sheet is good at; this is where somebody spends real time. Pushed
 * inside the current tab's stack, so the tab bar stays (ADR-0023) and Cancel
 * returns you where you started.
 *
 * ## A subject is created here, in the same screen as its first tasting
 *
 * There is no "add a cheese" screen, because a subject only exists because
 * somebody tasted it. Choosing a catalog entry prefills the facts block and
 * the rest is identical.
 *
 * ## The score is above everything
 *
 * Before any Kind-specific field, so it reads as the answer to "was it good"
 * rather than as another attribute — and it is the only thing Save requires.
 * Everything under it is optional, and the app never comes back later asking
 * you to finish.
 *
 * ## Three modes, one screen
 *
 * `new` logs a Tasting (creating the subject if it is new), `tasting` corrects
 * one you wrote, and `subject` corrects the facts. They are one screen because
 * the controls are identical and two copies would drift; which one is running
 * is entirely `mode`.
 */
import type { TastingAttributeValue, TastingKind } from '@gather/core/tastings'
import { tastingFields } from '@gather/core/tastings'
import { useMutation, useQuery } from 'convex/react'
import { Stack, useRouter } from 'expo-router'
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
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { haptics } from '../../feedback/haptics'
import { useGroup } from '../../group/GroupProvider'
import { fmt, useI18n } from '../../i18n'
import { RADIUS, useTokens } from '../../theme/tokens'
import { StarRating } from './StarRating'
import { subjectFacts } from './summary'
import { TastedAtField, todayIso } from './TastedAtField'
import { TastingField } from './TastingField'
import { kindWords } from './words'

type Attributes = Record<string, TastingAttributeValue>

export type ComposerMode = 'new' | 'tasting' | 'subject'

export interface ComposerScreenProps {
  kind: TastingKind
  mode: ComposerMode
  /** The subject being tasted or edited. Absent only when creating one. */
  subjectId?: string
  /** The Tasting being corrected, in `tasting` mode. */
  tastingId?: string
  /** A name chosen or typed in the picker, in `new` mode. */
  name?: string
  catalogKey?: string
}

export function ComposerScreen({
  kind,
  mode,
  subjectId,
  tastingId,
  name: chosenName,
  catalogKey,
}: ComposerScreenProps) {
  const tokens = useTokens('tasting')
  const insets = useSafeAreaInsets()
  const { t } = useI18n()
  const { group } = useGroup()
  const router = useRouter()

  const logTasting = useMutation(api.tastings.logTasting)
  const updateTasting = useMutation(api.tastings.updateTasting)
  const updateSubject = useMutation(api.tastings.updateSubject)

  const page = useQuery(
    api.tastings.getSubject,
    subjectId
      ? {
          groupSlug: group.slug,
          id: subjectId as Id<'tastingSubjects'>,
          kind,
        }
      : 'skip',
  )

  const words = kindWords(t.tastings, kind)
  const composer = t.tastings.composer

  /**
   * Seeded lazily and only once. Re-deriving from the query on every render
   * would throw away every keystroke as it was typed, and the query is live.
   */
  const [seeded, setSeeded] = useState(false)
  const [name, setName] = useState(chosenName ?? '')
  const [facts, setFacts] = useState<Attributes>({})
  const [rating, setRating] = useState<number | null>(null)
  const [tastedAt, setTastedAt] = useState(todayIso())
  const [impressions, setImpressions] = useState<Attributes>({})
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  const editing = mode !== 'new'

  /**
   * A catalog entry only *prefills*: the facts arrive here as a starting point
   * the person can correct before saving, and what is stored is what they
   * saved. Read from the catalog rather than carried through the navigation
   * params, so a long facts object does not have to survive being a URL.
   */
  const catalog = useQuery(
    api.tastings.catalogByKind,
    catalogKey && !subjectId ? { kind } : 'skip',
  )
  const prefill = catalogKey
    ? catalog?.find((entry) => entry.seedKey === catalogKey)
    : undefined

  const loading =
    (subjectId !== undefined && page === undefined) ||
    (catalogKey !== undefined && !subjectId && catalog === undefined)

  if (!seeded && (page || prefill)) {
    // One guarded assignment rather than an effect: an effect runs after the
    // first paint, and the form would visibly fill itself in.
    setSeeded(true)
    if (page) {
      setName(page.subject.name)
      setFacts({ ...page.subject.attributes })
      if (mode === 'tasting') {
        const row = page.tastings.find((entry) => entry._id === tastingId)
        if (row) {
          setRating(row.rating)
          setTastedAt(row.tastedAt)
          setImpressions({ ...row.attributes })
        }
      }
    } else if (prefill) {
      setName(prefill.name)
      setFacts({ ...prefill.attributes })
    }
  }

  if (loading) {
    return (
      <View style={[styles.centre, { backgroundColor: tokens.bg }]}>
        <ActivityIndicator color={tokens.muted} />
      </View>
    )
  }

  if (subjectId && page === null) {
    // Deleted from another device, or a stale deep link.
    return (
      <View style={[styles.centre, { backgroundColor: tokens.bg }]}>
        <Text style={{ color: tokens.muted }}>{t.tastings.index.noScore}</Text>
      </View>
    )
  }

  const title =
    mode === 'new'
      ? words.newTasting
      : mode === 'subject'
        ? t.tastings.subject.editSubject
        : t.tastings.subject.edit

  const needsName = mode !== 'tasting'
  const needsScore = mode !== 'subject'
  const blocked =
    busy ||
    (needsName && name.trim().length === 0) ||
    (needsScore && rating === null)

  function setFact(key: string, next: TastingAttributeValue | undefined) {
    setFacts((current) => {
      const updated = { ...current }
      if (next === undefined) delete updated[key]
      else updated[key] = next
      return updated
    })
  }

  function setImpression(key: string, next: TastingAttributeValue | undefined) {
    setImpressions((current) => {
      const updated = { ...current }
      if (next === undefined) delete updated[key]
      else updated[key] = next
      return updated
    })
  }

  async function save() {
    if (blocked) {
      haptics.actionFailed()
      return
    }
    setBusy(true)
    setFailure(null)
    try {
      if (mode === 'subject' && subjectId) {
        await updateSubject({
          groupSlug: group.slug,
          id: subjectId as Id<'tastingSubjects'>,
          name: name.trim(),
          attributes: facts,
        })
      } else if (mode === 'tasting' && tastingId) {
        await updateTasting({
          groupSlug: group.slug,
          id: tastingId as Id<'tastings'>,
          rating: rating ?? 0,
          tastedAt,
          attributes: impressions,
        })
      } else {
        await logTasting({
          groupSlug: group.slug,
          kind,
          // An existing subject is referenced; a new one carries its facts and
          // its provenance. The mutation is idempotent on the catalog key, so
          // two people choosing Comté at once still make one Comté.
          subject: subjectId
            ? { subjectId: subjectId as Id<'tastingSubjects'> }
            : { name: name.trim(), attributes: facts, catalogKey },
          rating: rating ?? 0,
          tastedAt,
          attributes: impressions,
        })
      }
      haptics.itemSaved()
      // Back where you started — the handoff rule in docs/mobile-interaction.md.
      router.back()
    } catch (error) {
      haptics.actionFailed()
      setFailure(
        error instanceof Error && error.message.includes('notYourTasting')
          ? fmt(t.tastings.subject.notYours, { name: t.tastings.subject.you })
          : t.errors.generic,
      )
    } finally {
      setBusy(false)
    }
  }

  /**
   * The facts block is drawn only where it can be *filled in*: creating a
   * subject, or correcting one. Tasting something the Group already has shows
   * the subject row at the top instead — it already says "Cow · France ·
   * Hard", and a full block of controls that silently refuse the press is
   * worse than no block at all. Correcting a bottle is a different act from
   * rating it and has its own entry in the subject's menu.
   */
  const showFacts = mode === 'subject' || (mode === 'new' && !subjectId)
  const showTasting = mode !== 'subject'

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: tokens.bg }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 32 },
        ]}
      >
        {subjectId && page ? (
          <View
            style={[
              styles.subjectRow,
              { backgroundColor: tokens.surface, borderColor: tokens.border },
            ]}
          >
            <View style={[styles.thumb, { backgroundColor: tokens.tile }]} />
            <View style={styles.subjectText}>
              <Text style={[styles.subjectName, { color: tokens.fg }]}>
                {page.subject.name}
              </Text>
              <Text style={[styles.subjectNote, { color: tokens.muted }]}>
                {subjectFacts(t.tastings, kind, page.subject.attributes) ||
                  fmt(composer.newHere, { group: group.name })}
              </Text>
            </View>
          </View>
        ) : null}

        {showFacts ? (
          <>
            <Text style={[styles.heading, { color: tokens.muted }]}>
              {words.facts.toUpperCase()}
            </Text>

            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: tokens.muted }]}>
                {composer.name.toUpperCase()}
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                editable={!busy}
                placeholder={words.one}
                placeholderTextColor={tokens.muted}
                accessibilityLabel={words.one}
                style={[
                  styles.nameInput,
                  {
                    backgroundColor: tokens.surface,
                    borderColor: tokens.border,
                    color: tokens.fg,
                  },
                ]}
              />
            </View>

            {tastingFields(kind, 'subject').map((field) => (
              <TastingField
                key={field.key}
                field={field}
                value={facts[field.key]}
                onChange={(next) => setFact(field.key, next)}
                disabled={busy}
              />
            ))}
          </>
        ) : null}

        {showFacts && showTasting ? (
          <View style={[styles.rule, { backgroundColor: tokens.border }]} />
        ) : null}

        {showTasting ? (
          <>
            <Text style={[styles.heading, { color: tokens.muted }]}>
              {composer.myTasting.toUpperCase()}
            </Text>

            <StarRating value={rating} onChange={setRating} />

            <TastedAtField
              value={tastedAt}
              onChange={setTastedAt}
              disabled={busy}
            />

            {tastingFields(kind, 'tasting').map((field) => (
              <TastingField
                key={field.key}
                field={field}
                value={impressions[field.key]}
                onChange={(next) => setImpression(field.key, next)}
                disabled={busy}
              />
            ))}
          </>
        ) : null}

        {failure ? (
          <Text style={[styles.error, { color: tokens.danger }]}>
            {failure}
          </Text>
        ) : null}

        <View style={styles.buttons}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={composer.cancel}
            disabled={busy}
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.button,
              styles.secondary,
              { borderColor: tokens.border },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.buttonText, { color: tokens.fg }]}>
              {composer.cancel}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={editing ? composer.saveEdit : composer.save}
            accessibilityState={{ disabled: blocked }}
            disabled={blocked}
            onPress={save}
            style={({ pressed }) => [
              styles.button,
              {
                backgroundColor: blocked
                  ? tokens.tile
                  : tokens.tintOf('tasting').fg,
              },
              pressed && styles.pressed,
            ]}
          >
            {busy ? (
              <ActivityIndicator color={tokens.surface} />
            ) : (
              <Text
                style={[
                  styles.buttonText,
                  { color: blocked ? tokens.muted : tokens.surface },
                ]}
              >
                {editing ? composer.saveEdit : composer.save}
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 16, paddingTop: 12, gap: 16 },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    minHeight: 56,
    paddingHorizontal: 13,
    borderRadius: RADIUS.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  thumb: { width: 36, height: 36, borderRadius: 11 },
  subjectText: { flex: 1, gap: 1 },
  subjectName: { fontSize: 16, fontWeight: '600' },
  subjectNote: { fontSize: 13 },
  heading: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  field: { gap: 7 },
  fieldLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  nameInput: {
    minHeight: 48,
    paddingHorizontal: 14,
    fontSize: 16,
    borderRadius: RADIUS.control,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rule: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
  error: { fontSize: 13 },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 8 },
  button: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.control,
  },
  secondary: { borderWidth: StyleSheet.hairlineWidth },
  buttonText: { fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.6 },
})
