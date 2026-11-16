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
 * The top is the group's wash with the Module's tile and the count. Rows sit
 * in an `InsetList`; a row with no photo carries the Module's `tile-s` in the
 * thumbnail's column, so the list does not comb.
 */
import type { TastingKind } from '@gather/core/tastings'
import { Stack, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { SearchField } from '../../components/SearchField'
import { api } from '../../convex/api'
import { useQuery } from '../../convex/queries'
import { useGroup } from '../../group/GroupProvider'
import { fmt, plural, useI18n } from '../../i18n'
import { RADIUS, SPACE, TABULAR, TYPE, useTokens } from '../../theme/tokens'
import { InsetList, InsetRow } from '../../ui/inset-list'
import { ModuleTile, moduleTile } from '../../ui/module-tile'
import { RecordThumb } from '../../ui/record-thumb'
import { washScreenOptions } from '../../ui/screen-header'
import { isAccessibilityTextSize } from '../../ui/text-scale'
import { WashHeader } from '../../ui/wash-header'
import { moduleHref } from '../moduleDestination'
import { CaptureFlow, useCapture } from './CaptureFlow'
import { KIND_ICONS, TASTING_UI_ICONS } from './icons'
import { moduleIdOf } from './paths'
import { subjectFacts, tastingCount } from './summary'
import { kindWords } from './words'

export function IndexScreen({ kind }: { kind: TastingKind }) {
  const tokens = useTokens('tasting')
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { t, locale } = useI18n()
  const { group } = useGroup()
  const [query, setQuery] = useState('')
  const capture = useCapture(kind)
  // At accessibility sizes the score moves under the subtitle: beside it, the
  // score column squeezed a long subtitle until it broke mid-word.
  const stacked = isAccessibilityTextSize(useWindowDimensions().fontScale)

  const words = kindWords(t.tastings, kind)

  const score = (subject: { average: number | null; count: number }) => (
    <View style={stacked ? styles.rowScoreStacked : styles.rowScore}>
      {subject.average === null ? (
        <Text
          style={[styles.rowCount, { color: tokens.muted }]}
        >
          {t.tastings.index.noScore}
        </Text>
      ) : (
        <>
          <Text style={[styles.score, { color: tokens.ink }]}>
            {subject.average.toFixed(1)}
          </Text>
          <Text
            style={[styles.rowCount, { color: tokens.muted }]}
          >
            {tastingCount(t, locale, subject.count)}
          </Text>
        </>
      )}
    </View>
  )
  const Plus = TASTING_UI_ICONS.Plus
  const tile = moduleTile(moduleIdOf(kind)) ?? {
    group: 'tasting' as const,
    glyph: KIND_ICONS[kind],
  }

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
        ...washScreenOptions(title),
        headerRight: () => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.tastings.index.add}
            onPress={capture.open}
            hitSlop={12}
          >
            <Plus size={24} color={tokens.accentText} strokeWidth={2} />
          </Pressable>
        ),
      }}
    />
  )

  if (subjects === undefined) {
    return (
      <>
        {header}
        <View style={{ flex: 1, backgroundColor: tokens.ground }}>
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
        <View style={[styles.emptyScreen, { backgroundColor: tokens.ground }]}>
          <ModuleTile group={tile.group} glyph={tile.glyph} size="l" />
          <Text style={[styles.emptyTitle, { color: tokens.ink }]}>
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
              { backgroundColor: tokens.accent },
              pressed && styles.pressed,
            ]}
          >
            <Plus size={18} color={tokens.onAccent} strokeWidth={2.2} />
            <Text style={[styles.emptyButtonText, { color: tokens.onAccent }]}>
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
        style={{ backgroundColor: tokens.ground }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        <WashHeader
          group={tile.group}
          glyph={tile.glyph}
          summary={{
            count: plural(
              locale,
              subjects.length,
              t.tastings.index.subjectCount,
            ),
            scope: tastingCount(t, locale, totalTastings),
          }}
        />

        <View style={styles.content}>
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder={t.tastings.index.search}
            clearAccessibilityLabel={t.tastings.index.clearSearch}
          />

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
                <Text style={[styles.clear, { color: tokens.accentText }]}>
                  {t.tastings.index.clearSearch}
                </Text>
              </Pressable>
            </View>
          ) : (
            <InsetList>
              {rows.map((subject) => (
                <InsetRow
                  key={subject._id}
                  accessibilityLabel={subject.name}
                  onPress={() =>
                    router.push(
                      moduleHref(`/all/tasting/${kind}/subject`, {
                        subjectId: subject._id,
                      }),
                    )
                  }
                  leading={
                    <RecordThumb
                      uri={subject.photoUrl}
                      group={tile.group}
                      glyph={tile.glyph}
                    />
                  }
                  title={subject.name}
                  subtitle={
                    subjectFacts(t.tastings, kind, subject.attributes) ||
                    undefined
                  }
                  trailing={stacked ? undefined : score(subject)}
                >
                  {stacked ? score(subject) : null}
                </InsetRow>
              ))}
            </InsetList>
          )}
        </View>
      </ScrollView>
      <CaptureFlow capture={capture} />
    </>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SPACE[4], gap: SPACE[3] },
  summary: { ...TYPE.footnote },
  noResults: { gap: 6, paddingVertical: 12 },
  clear: { ...TYPE.bodyStrong },
  rowScore: { alignItems: 'flex-end', gap: 2 },
  rowScoreStacked: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: SPACE[2],
  },
  score: { ...TYPE.bodyStrong, ...TABULAR },
  rowCount: { ...TYPE.footnote },
  emptyScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 40,
    paddingBottom: 60,
  },
  emptyTitle: { ...TYPE.title2, letterSpacing: -0.4 },
  emptyBody: { ...TYPE.subhead, textAlign: 'center' },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 48,
    paddingHorizontal: 22,
    borderRadius: RADIUS.pill,
  },
  emptyButtonText: { ...TYPE.bodyStrong },
  pressed: { opacity: 0.6 },
})
