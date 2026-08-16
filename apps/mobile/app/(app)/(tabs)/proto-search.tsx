/**
 * PROTOTYPE — throwaway. See `src/prototype/tabLayout/README.md`.
 *
 * Search, so the tab has something behind it worth judging. Records are a
 * static fixture; the shape is what #172 describes — results from live
 * Modules in the current Group, and a separately marked "Only you" section that
 * is never presented as the Group's.
 *
 * The same screen in all three variants: the question is the bar, not this.
 */
import { moduleById, moduleText } from '@gather/core/modules'
import { useMemo, useState } from 'react'
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useGroup } from '../../../src/group/GroupProvider'
import { useI18n } from '../../../src/i18n'
import { MODULE_ICONS } from '../../../src/theme/icons'
import { RADIUS, useTokens } from '../../../src/theme/tokens'

interface SearchResult {
  id: string
  title: string
  detail: string
  moduleId: string
  personal?: boolean
}

const RECORDS: SearchResult[] = [
  {
    id: '1',
    title: 'Pasta alla Norma',
    detail: '45 min · 4 servings',
    moduleId: 'recipes',
  },
  {
    id: '2',
    title: 'Sunday pancakes',
    detail: '20 min · 2 servings',
    moduleId: 'recipes',
  },
  {
    id: '3',
    title: 'Pick up the parcel',
    detail: 'Errands · due today',
    moduleId: 'tasks',
  },
  {
    id: '4',
    title: 'Paint the hallway',
    detail: 'House · no due date',
    moduleId: 'tasks',
  },
  {
    id: '5',
    title: 'Pan-fried salmon',
    detail: 'Logged Tuesday · 480 kcal',
    moduleId: 'nutrition',
    personal: true,
  },
  {
    id: '6',
    title: 'Peanut butter, 100 g',
    detail: 'Food · 588 kcal',
    moduleId: 'nutrition',
    personal: true,
  },
]

export default function ProtoSearch() {
  const tokens = useTokens()
  const { t } = useI18n()
  const insets = useSafeAreaInsets()
  const { group } = useGroup()
  const [query, setQuery] = useState('pa')

  const { shared, mine } = useMemo(() => {
    const q = query.trim().toLowerCase()
    const hits = q
      ? RECORDS.filter((r) => r.title.toLowerCase().includes(q))
      : []
    return {
      shared: hits.filter((r) => !r.personal),
      mine: hits.filter((r) => r.personal),
    }
  }, [query])

  return (
    <ScrollView
      style={{ backgroundColor: tokens.bg }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 44, paddingBottom: insets.bottom + 120 },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: tokens.fg }]}
      >
        Search
      </Text>
      <Text style={[styles.scope, { color: tokens.muted }]}>
        In {group.name}
      </Text>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Recipes, tasks, foods…"
        placeholderTextColor={tokens.muted}
        autoCorrect={false}
        style={[
          styles.field,
          {
            backgroundColor: tokens.tile,
            borderColor: tokens.border,
            color: tokens.fg,
          },
        ]}
      />

      {query.trim() === '' ? (
        <Text style={[styles.empty, { color: tokens.muted }]}>
          Type to search this Group.
        </Text>
      ) : shared.length + mine.length === 0 ? (
        <Text style={[styles.empty, { color: tokens.muted }]}>
          Nothing matches “{query}”.
        </Text>
      ) : (
        <>
          <Section
            heading={group.name}
            records={shared}
            tokens={tokens}
            messages={t}
          />
          <Section
            heading="Only you"
            note="Personal records. Nobody else in this Group sees these."
            records={mine}
            tokens={tokens}
            messages={t}
          />
        </>
      )}
    </ScrollView>
  )
}

function Section({
  heading,
  note,
  records,
  tokens,
  messages,
}: {
  heading: string
  note?: string
  records: SearchResult[]
  tokens: ReturnType<typeof useTokens>
  messages: ReturnType<typeof useI18n>['t']
}) {
  if (records.length === 0) return null
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: tokens.fg }]}>{heading}</Text>
      {note ? (
        <Text style={[styles.sectionNote, { color: tokens.muted }]}>
          {note}
        </Text>
      ) : null}
      {records.map((record) => {
        const module = moduleById(record.moduleId)
        if (!module) return null
        const tint = tokens.tintOf(module.group)
        const Icon = MODULE_ICONS[module.icon]
        return (
          <View
            key={record.id}
            style={[styles.row, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
          >
            <View style={[styles.rowIcon, { backgroundColor: tint.bg }]}>
              <Icon size={19} color={tint.fg} strokeWidth={1.8} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: tokens.fg }]}>
                {record.title}
              </Text>
              <Text style={[styles.rowDetail, { color: tokens.muted }]}>
                {moduleText(module, messages).label} · {record.detail}
              </Text>
            </View>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 6 },
  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  scope: { fontSize: 15 },
  field: {
    marginTop: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.control,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  empty: { marginTop: 22, fontSize: 15, lineHeight: 22 },
  section: { marginTop: 24, gap: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  sectionNote: { fontSize: 13, lineHeight: 18, marginTop: -4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.card,
    padding: 12,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.tile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowDetail: { fontSize: 13 },
})
