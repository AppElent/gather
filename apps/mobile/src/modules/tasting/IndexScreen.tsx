/**
 * One Module's index — and the same screen for all three Kinds.
 *
 * **Nothing in the layout is per Kind, only the data the spec declares.** That
 * is the rule the implementation has to keep: a row is the subject, its facts,
 * the household's average and how many tastings that rests on, whichever of
 * cheese, wine or beer it is.
 *
 * An Index title (`headerLargeTitle`, set on the stack) with the platform's own
 * search field under it. The scroll view is the screen's first subview and
 * carries `contentInsetAdjustmentBehavior="automatic"`, which is the pair of
 * things that make the large title actually collapse.
 *
 * **The average never appears without its count**: 5.0 from one person is not
 * 5.0 from four. A subject nobody has rated yet shows neither.
 *
 * Rows with no photo keep the 48px tile rather than reflowing, so the list does
 * not comb.
 */
import type { TastingKind } from '@gather/core/tastings'
import { useQuery } from 'convex/react'
import { Image } from 'expo-image'
import { Stack, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { api } from '../../../../../convex/_generated/api'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { useGroup } from '../../group/GroupProvider'
import { fmt, useI18n } from '../../i18n'
import { UI_ICONS } from '../../theme/icons'
import { RADIUS, useTokens } from '../../theme/tokens'
import { CaptureFlow, useCapture } from './CaptureFlow'
import { KIND_ICONS, TASTING_UI_ICONS } from './icons'
import type { TastingBase } from './paths'
import { moduleIdOf, tastingHref } from './paths'
import { indexSummary, subjectFacts, tastingCount } from './summary'
import { kindWords } from './words'

export function IndexScreen({
  base,
  kind,
}: {
  base: TastingBase
  kind: TastingKind
}) {
  const tokens = useTokens('tasting')
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { t, locale } = useI18n()
  const { group } = useGroup()
  const [query, setQuery] = useState('')
  const capture = useCapture(base, kind)

  const words = kindWords(t.tastings, kind)
  const Search = UI_ICONS.Search
  const Plus = TASTING_UI_ICONS.Plus
  const Photo = TASTING_UI_ICONS.Image
  const KindIcon = KIND_ICONS[kind]
  const tint = tokens.tintOf('tasting')

  // The Module's own name from the shared catalogue: the header must not
  // invent a second word for a Module the rest of the app already names.
  const moduleId = moduleIdOf(kind)
  const title =
    (t.modules.byId as Record<string, { label: string }>)[moduleId]?.label ??
    words.many

  const subjects = useQuery(api.tastings.listByKind, {
    groupSlug: group.slug,
    kind,
  })

  const needle = query.trim().toLowerCase()
  const rows = useMemo(
    () =>
      (subjects ?? []).filter(
        (subject) => !needle || subject.name.toLowerCase().includes(needle),
      ),
    [subjects, needle],
  )
  const totalTastings = (subjects ?? []).reduce(
    (sum, subject) => sum + subject.count,
    0,
  )

  const header = (
    <Stack.Screen
      options={{
        headerShown: true,
        title,
        headerRight: () => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.tastings.index.add}
            onPress={capture.open}
            hitSlop={12}
          >
            <Plus size={24} color={tint.fg} strokeWidth={2} />
          </Pressable>
        ),
      }}
    />
  )

  if (subjects === undefined) {
    return (
      <>
        {header}
        <View style={{ flex: 1, backgroundColor: tokens.bg }}>
          <LoadingSkeleton rows={5} label={t.actions.loading} />
        </View>
      </>
    )
  }

  /**
   * *Nothing yet* — one button that adds the first thing, and deliberately not
   * "switch this Module on". A Group that never opens Cheeses stores nothing
   * (ADR-0024), and this screen is what that costs: an invitation, not a setup
   * step.
   */
  if (subjects.length === 0) {
    return (
      <>
        {header}
        <View style={[styles.emptyScreen, { backgroundColor: tokens.bg }]}>
          <View style={[styles.emptyIcon, { backgroundColor: tint.bg }]}>
            <KindIcon size={34} color={tint.fg} strokeWidth={1.6} />
          </View>
          <Text style={[styles.emptyTitle, { color: tokens.fg }]}>
            {fmt(t.tastings.empty.title, { kind: words.many })}
          </Text>
          <Text style={[styles.emptyBody, { color: tokens.muted }]}>
            {fmt(t.tastings.empty.body, { group: group.name })}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={fmt(t.tastings.empty.action, {
              kind: words.one,
            })}
            onPress={capture.open}
            style={({ pressed }) => [
              styles.emptyButton,
              { backgroundColor: tint.fg },
              pressed && styles.pressed,
            ]}
          >
            <Plus size={18} color={tokens.surface} strokeWidth={2.2} />
            <Text style={[styles.emptyButtonText, { color: tokens.surface }]}>
              {fmt(t.tastings.empty.action, { kind: words.one })}
            </Text>
          </Pressable>
        </View>
        <CaptureFlow capture={capture} />
      </>
    )
  }

  return (
    <>
      {header}
      {/* First subview in the screen, deliberately: UIKit only honours
        `contentInsetAdjustmentBehavior="automatic"` — and so only collapses
        the large title — when the scroll view is the screen's first child. */}
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: tokens.bg }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 32 },
        ]}
      >
        <View
          style={[
            styles.search,
            { backgroundColor: tokens.tile, borderColor: tokens.border },
          ]}
        >
          <Search size={17} color={tokens.muted} strokeWidth={2} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t.tastings.index.search}
            placeholderTextColor={tokens.muted}
            accessibilityLabel={t.tastings.index.search}
            style={[styles.searchInput, { color: tokens.fg }]}
          />
        </View>

        <Text style={[styles.summary, { color: tokens.muted }]}>
          {indexSummary(t, locale, subjects.length, totalTastings)}
        </Text>

        {rows.length === 0 ? (
          /* *Nothing found* — a way to clear the search, never an add button. */
          <View style={styles.noResults}>
            <Text style={[styles.summary, { color: tokens.muted }]}>
              {t.tastings.index.searchEmpty}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.tastings.index.clearSearch}
              onPress={() => setQuery('')}
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <Text style={[styles.clear, { color: tint.fg }]}>
                {t.tastings.index.clearSearch}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {rows.map((subject) => (
          <Pressable
            key={subject._id}
            accessibilityRole="button"
            accessibilityLabel={subject.name}
            onPress={() =>
              router.push(
                tastingHref(base, kind, '/subject', {
                  subjectId: subject._id,
                }),
              )
            }
            style={({ pressed }) => [
              styles.row,
              { borderBottomColor: tokens.border },
              pressed && { backgroundColor: tokens.tile },
            ]}
          >
            {subject.photoUrl ? (
              <Image
                source={{ uri: subject.photoUrl }}
                style={[styles.thumb, { backgroundColor: tokens.tile }]}
                contentFit="cover"
                accessibilityIgnoresInvertColors
              />
            ) : (
              <View style={[styles.thumb, { backgroundColor: tokens.tile }]}>
                <Photo size={20} color={tokens.muted} strokeWidth={1.8} />
              </View>
            )}
            <View style={styles.rowText}>
              <Text style={[styles.rowName, { color: tokens.fg }]}>
                {subject.name}
              </Text>
              <Text style={[styles.rowFacts, { color: tokens.muted }]}>
                {subjectFacts(t.tastings, kind, subject.attributes)}
              </Text>
            </View>
            <View style={styles.rowScore}>
              {subject.average === null ? (
                <Text style={[styles.rowCount, { color: tokens.muted }]}>
                  {t.tastings.index.noScore}
                </Text>
              ) : (
                <>
                  <Text style={[styles.score, { color: tint.fg }]}>
                    {subject.average.toFixed(1)}
                  </Text>
                  <Text style={[styles.rowCount, { color: tokens.muted }]}>
                    {tastingCount(t, locale, subject.count)}
                  </Text>
                </>
              )}
            </View>
          </Pressable>
        ))}
      </ScrollView>
      <CaptureFlow capture={capture} />
    </>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, fontSize: 16 },
  summary: { fontSize: 13 },
  noResults: { gap: 6, paddingVertical: 12 },
  clear: { fontSize: 15, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 70,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  rowName: { fontSize: 16, fontWeight: '600' },
  rowFacts: { fontSize: 13 },
  rowScore: { alignItems: 'flex-end', gap: 2 },
  score: { fontSize: 16, fontWeight: '700' },
  rowCount: { fontSize: 12 },
  emptyScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 40,
    paddingBottom: 60,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.4 },
  emptyBody: { fontSize: 15, lineHeight: 21, textAlign: 'center' },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 48,
    paddingHorizontal: 22,
    borderRadius: RADIUS.control,
  },
  emptyButtonText: { fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.6 },
})
