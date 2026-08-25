/**
 * Which thing did you taste? — the first half of capture.
 *
 * ## Why this is a sheet and the composer is not
 *
 * Choosing a subject is a search, a list and a create row. It needs a keyboard
 * and almost no room, which is exactly what a sheet is good at, and it keeps
 * you where you were — the whole point of pressing Add. The *composer* is the
 * opposite: score, date, scales, aromas and notes do not fit above a keyboard,
 * and it is the one place a Member spends real time, so it is a pushed screen.
 * That split is the design's "mix" (see `prototypes/tasting-modules`).
 *
 * ## Two lists and a create row
 *
 * What the Group already has comes first, because tasting something again is
 * the common case and it is the only branch that adds no rows. The shipped
 * catalog is second and is absent entirely for wine and beer, which ship none
 * — an empty "Well-known wines" heading would be a promise the Module is not
 * making (story 6).
 *
 * Typing filters both halves at once and grows a create row, so "type a name"
 * and "find the one I mean" are one gesture rather than a mode.
 *
 * ## The duplicate is a warning and never a refusal
 *
 * Two Barolos from two producers are two subjects, and only the person adding
 * them knows which case this is (story 5). So a name that matches something
 * the Group has says so, offers the existing one, and lets you carry on.
 */
import type { TastingKind } from '@gather/core/tastings'
import { useQuery } from 'convex/react'
import { useMemo, useState } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { api } from '../../../../../convex/_generated/api'
import { NativeSheet } from '../../components/NativeSheet'
import { useGroup } from '../../group/GroupProvider'
import { fmt, useI18n } from '../../i18n'
import { UI_ICONS } from '../../theme/icons'
import { RADIUS, useTokens } from '../../theme/tokens'
import { KIND_ICONS, TASTING_UI_ICONS } from './icons'
import { subjectFacts } from './summary'
import { kindWords } from './words'

/** What the sheet hands back: an existing subject, or a name to create. */
export type SubjectChoice =
  | { subjectId: string }
  | { name: string; catalogKey?: string }

export function SubjectPickerSheet({
  kind,
  onChoose,
  onClose,
  leading,
}: {
  kind: TastingKind
  onChoose: (choice: SubjectChoice) => void
  onClose: () => void
  /** A Back control, where the sheet was opened from somewhere else. */
  leading?: React.ReactNode
}) {
  const tokens = useTokens('tasting')
  const { t } = useI18n()
  const { group } = useGroup()
  const [query, setQuery] = useState('')

  const words = kindWords(t.tastings, kind)
  const Search = UI_ICONS.Search
  const Chevron = UI_ICONS.ChevronRight
  const Alert = UI_ICONS.CircleAlert
  const Plus = TASTING_UI_ICONS.Plus
  const KindIcon = KIND_ICONS[kind]

  const subjects = useQuery(api.tastings.listByKind, {
    groupSlug: group.slug,
    kind,
  })
  const catalog = useQuery(api.tastings.catalogByKind, { kind })

  const typed = query.trim()
  const needle = typed.toLowerCase()

  const mine = useMemo(
    () =>
      (subjects ?? []).filter(
        (subject) => !needle || subject.name.toLowerCase().includes(needle),
      ),
    [subjects, needle],
  )

  /**
   * A catalog entry the Group has already materialised is not offered twice.
   * Choosing it would land on the same subject anyway — materialising is
   * idempotent — but two rows reading "Comté" is a list that looks broken.
   */
  const shipped = useMemo(() => {
    const taken = new Set(
      (subjects ?? [])
        .map((subject) => subject.catalogKey)
        .filter((key): key is string => key !== undefined),
    )
    return (catalog ?? []).filter(
      (entry) =>
        !taken.has(entry.seedKey) &&
        (!needle || entry.name.toLowerCase().includes(needle)),
    )
  }, [catalog, subjects, needle])

  // Only a name that *starts* the same warns. A substring match would fire on
  // every "de" typed into a list of French cheeses.
  const clash = typed
    ? (subjects ?? []).find((subject) =>
        subject.name.toLowerCase().startsWith(needle),
      )
    : undefined

  return (
    <NativeSheet
      title={fmt(t.tastings.picker.title, { kind: words.one })}
      subtitle={fmt(t.tastings.picker.mine, { group: group.name })}
      onClose={onClose}
      leading={leading}
      maxHeight={0.8}
      fill
    >
      <View
        style={[
          styles.search,
          { backgroundColor: tokens.bg, borderColor: tokens.border },
        ]}
      >
        <Search size={18} color={tokens.muted} strokeWidth={2} />
        <TextInput
          autoFocus
          value={query}
          onChangeText={setQuery}
          placeholder={t.tastings.picker.search}
          placeholderTextColor={tokens.muted}
          accessibilityLabel={t.tastings.picker.search}
          returnKeyType="done"
          style={[styles.searchInput, { color: tokens.fg }]}
        />
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" style={styles.list}>
        {mine.length > 0 ? (
          <>
            <Text style={[styles.heading, { color: tokens.muted }]}>
              {fmt(t.tastings.picker.mine, {
                group: group.name,
              }).toUpperCase()}
            </Text>
            {mine.map((subject) => (
              <Pressable
                key={subject._id}
                accessibilityRole="button"
                accessibilityLabel={subject.name}
                onPress={() => onChoose({ subjectId: subject._id })}
                style={({ pressed }) => [
                  styles.row,
                  { borderBottomColor: tokens.border },
                  pressed && { backgroundColor: tokens.tile },
                ]}
              >
                <View
                  style={[styles.thumb, { backgroundColor: tokens.tile }]}
                />
                <View style={styles.rowText}>
                  <Text style={[styles.rowName, { color: tokens.fg }]}>
                    {subject.name}
                  </Text>
                  <Text style={[styles.rowFacts, { color: tokens.muted }]}>
                    {subjectFacts(t.tastings, kind, subject.attributes)}
                  </Text>
                </View>
                {subject.average !== null ? (
                  <Text style={[styles.rowScore, { color: tokens.muted }]}>
                    {subject.average.toFixed(1)} · {subject.count}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </>
        ) : null}

        {shipped.length > 0 ? (
          <>
            <Text style={[styles.heading, { color: tokens.muted }]}>
              {words.catalogHeading.toUpperCase()}
            </Text>
            {shipped.map((entry) => (
              <Pressable
                key={entry.seedKey}
                accessibilityRole="button"
                accessibilityLabel={entry.name}
                onPress={() =>
                  onChoose({ name: entry.name, catalogKey: entry.seedKey })
                }
                style={({ pressed }) => [
                  styles.row,
                  { borderBottomColor: tokens.border },
                  pressed && { backgroundColor: tokens.tile },
                ]}
              >
                <View style={[styles.thumb, { backgroundColor: tokens.tile }]}>
                  <KindIcon size={17} color={tokens.muted} strokeWidth={1.9} />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowName, { color: tokens.fg }]}>
                    {entry.name}
                  </Text>
                  <Text style={[styles.rowFacts, { color: tokens.muted }]}>
                    {subjectFacts(t.tastings, kind, entry.attributes)}
                  </Text>
                </View>
                <Chevron size={18} color={tokens.muted} strokeWidth={2.2} />
              </Pressable>
            ))}
          </>
        ) : null}

        {typed ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={fmt(t.tastings.picker.create, { name: typed })}
            onPress={() => onChoose({ name: typed })}
            style={({ pressed }) => [
              styles.create,
              { borderColor: tokens.border },
              pressed && styles.pressed,
            ]}
          >
            <Plus
              size={20}
              color={tokens.tintOf('tasting').fg}
              strokeWidth={2}
            />
            <View style={styles.rowText}>
              <Text
                style={[
                  styles.createName,
                  { color: tokens.tintOf('tasting').fg },
                ]}
              >
                {fmt(t.tastings.picker.create, { name: typed })}
              </Text>
              <Text style={[styles.rowFacts, { color: tokens.muted }]}>
                {fmt(t.tastings.picker.createHint, { kind: words.one })}
              </Text>
            </View>
          </Pressable>
        ) : null}

        {clash ? (
          <View
            style={[
              styles.warning,
              { backgroundColor: tokens.tile, borderColor: tokens.border },
            ]}
          >
            <Alert size={18} color={tokens.danger} strokeWidth={1.9} />
            <Text style={[styles.warningText, { color: tokens.fg }]}>
              {fmt(t.tastings.picker.duplicate, { name: clash.name })}
            </Text>
          </View>
        ) : null}

        {!typed && mine.length === 0 && shipped.length === 0 ? (
          <Text style={[styles.empty, { color: tokens.muted }]}>
            {fmt(t.tastings.picker.createHint, { kind: words.one })}
          </Text>
        ) : null}
      </ScrollView>
    </NativeSheet>
  )
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    minHeight: 46,
    paddingHorizontal: 13,
    borderRadius: RADIUS.control,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, fontSize: 16 },
  list: { marginTop: 12 },
  heading: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    paddingBottom: 6,
    paddingTop: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  thumb: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 1 },
  rowName: { fontSize: 16 },
  rowFacts: { fontSize: 13 },
  rowScore: { fontSize: 13 },
  create: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    minHeight: 52,
    marginTop: 12,
    paddingHorizontal: 13,
    borderRadius: RADIUS.control,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  createName: { fontSize: 16, fontWeight: '600' },
  warning: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 12,
    padding: 12,
    borderRadius: RADIUS.control,
    borderWidth: StyleSheet.hairlineWidth,
  },
  warningText: { flex: 1, fontSize: 13, lineHeight: 18 },
  empty: { paddingVertical: 20, fontSize: 15, lineHeight: 21 },
  pressed: { opacity: 0.6 },
})
