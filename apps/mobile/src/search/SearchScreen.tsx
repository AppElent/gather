import { useQuery } from 'convex/react'
import { useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
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

import { api } from '../../../../convex/_generated/api'
import { useGroup } from '../group/GroupProvider'
import { useI18n } from '../i18n'
import { RADIUS, useTokens } from '../theme/tokens'
import {
  type RecentRecordInput,
  readRecentRecords,
  recordsForGroup,
  type SearchRecordType,
  saveRecentRecord,
} from './recentRecords'

type QueryResult = {
  id: string
  type: SearchRecordType
  title: string
  tags: string[]
  excerpt: string
  listName?: string
  dueDate?: string
  kind?: string
  calendarName?: string
  date?: string
  startMinutes?: number
  endMinutes?: number
}

type Result = QueryResult | RecentRecordInput

const SEARCH_DELAY_MS = 200

function useDebouncedQuery(query: string) {
  const [debounced, setDebounced] = useState(query)
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(query), SEARCH_DELAY_MS)
    return () => clearTimeout(timeout)
  }, [query])
  return debounced
}

export function SearchScreen() {
  const { group } = useGroup()
  const { t } = useI18n()
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const [text, setText] = useState('')
  const [recents, setRecents] = useState(readRecentRecords)
  const debounced = useDebouncedQuery(text)
  const trimmed = text.trim()
  const ready = trimmed.length >= 2
  const settled = debounced.trim() === trimmed
  const results = useQuery(
    api.search.group,
    ready && settled ? { groupSlug: group.slug, query: debounced } : 'skip',
  )
  const groupRecents = useMemo(
    () => recordsForGroup(recents, group.slug),
    [group.slug, recents],
  )

  const detailOf = (result: Result) => {
    if ('detail' in result) return result.detail
    if (result.type === 'recipe') return result.tags.join(', ')
    if (result.type === 'task')
      return [result.listName, result.dueDate].filter(Boolean).join(' - ')
    if (result.type === 'note') return result.excerpt
    if (result.type === 'tasting') {
      const kinds: Record<string, string> = t.search.kinds
      return result.kind ? (kinds[result.kind] ?? '') : ''
    }
    const time = (value?: number) =>
      value === undefined
        ? null
        : `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
    const start = time(result.startMinutes)
    const end = time(result.endMinutes)
    return [
      result.calendarName,
      result.date,
      start && end ? `${start}-${end}` : null,
    ]
      .filter(Boolean)
      .join(' - ')
  }

  const open = (result: Result) => {
    const recent: RecentRecordInput = {
      id: result.id,
      type: result.type,
      title: result.title,
      detail: detailOf(result),
    }
    saveRecentRecord(group.slug, recent)
    setRecents(readRecentRecords())
    if (result.type === 'recipe') {
      router.push({
        pathname: '/all/recipes/recipe',
        params: { recipeId: result.id },
      })
      return
    }
    if (result.type === 'task') {
      router.push({
        pathname: '/all/tasks/task/[taskId]',
        params: { taskId: result.id },
      })
      return
    }
    if (result.type === 'note') {
      router.push({
        pathname: '/all/notes/[noteId]',
        params: { noteId: result.id },
      })
      return
    }
    if (result.type === 'tasting') {
      router.push({
        pathname: '/all/tasting/[kind]/subject',
        params: {
          kind:
            'kind' in result
              ? (result.kind ?? '')
              : 'detail' in result
                ? result.detail
                : '',
          subjectId: result.id,
        },
      })
      return
    }
    router.push({
      pathname: '/all/calendar/[eventId]',
      params: { eventId: result.id },
    })
  }

  const typeLabel = (type: SearchRecordType) => t.search.types[type]
  const rows = (items: readonly Result[], recent = false) =>
    items.map((result, index) => (
      <Pressable
        key={`${result.type}:${result.id}`}
        testID={`search-result-${result.type}-${result.id}`}
        accessibilityRole="button"
        accessibilityLabel={`${result.title}, ${typeLabel(result.type)}`}
        onPress={() => open(result)}
        android_ripple={{ color: tokens.tile }}
        style={({ pressed }) => [
          styles.row,
          {
            backgroundColor: tokens.surface,
            borderBottomColor: tokens.border,
            borderBottomWidth:
              index === items.length - 1 ? 0 : StyleSheet.hairlineWidth,
          },
          pressed && { backgroundColor: tokens.tile },
        ]}
      >
        <View style={styles.rowText}>
          <Text numberOfLines={1} style={[styles.title, { color: tokens.fg }]}>
            {result.title}
          </Text>
          {detailOf(result) ? (
            <Text
              numberOfLines={1}
              style={[styles.detail, { color: tokens.muted }]}
            >
              {detailOf(result)}
            </Text>
          ) : null}
        </View>
        <View style={[styles.badge, { backgroundColor: tokens.tile }]}>
          <Text style={[styles.badgeText, { color: tokens.fg }]}>
            {recent ? t.search.recentBadge : typeLabel(result.type)}
          </Text>
        </View>
      </Pressable>
    ))

  const searching = ready && !settled
  const activeResults = ready && settled ? results : undefined

  return (
    <ScrollView
      style={{ backgroundColor: tokens.bg }}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <View
        style={[
          styles.search,
          { borderColor: tokens.border, backgroundColor: tokens.surface },
        ]}
      >
        <TextInput
          testID="group-search-input"
          value={text}
          onChangeText={setText}
          placeholder={t.search.placeholder}
          placeholderTextColor={tokens.muted}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          accessibilityLabel={t.search.placeholder}
          style={[styles.input, { color: tokens.fg }]}
        />
      </View>

      {!ready ? (
        <>
          <Text style={[styles.hint, { color: tokens.muted }]}>
            {t.search.minimum}
          </Text>
          {groupRecents.length > 0 ? (
            <View style={styles.section}>
              <Text
                accessibilityRole="header"
                style={[styles.sectionTitle, { color: tokens.muted }]}
              >
                {t.search.recent}
              </Text>
              <View style={[styles.card, { borderColor: tokens.border }]}>
                {rows(groupRecents, true)}
              </View>
            </View>
          ) : null}
        </>
      ) : searching || activeResults === undefined ? (
        <View testID="group-search-loading" style={styles.loading}>
          <ActivityIndicator color={tokens.muted} />
          <Text style={{ color: tokens.muted }}>{t.search.loading}</Text>
        </View>
      ) : activeResults.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: tokens.muted }]}>
            {t.search.noResults}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.search.clear}
            onPress={() => setText('')}
            style={({ pressed }) => [
              styles.clear,
              { borderColor: tokens.border },
              pressed && { backgroundColor: tokens.tile },
            ]}
          >
            <Text style={{ color: tokens.fg, fontWeight: '600' }}>
              {t.search.clear}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={[styles.card, { borderColor: tokens.border }]}>
          {rows(activeResults)}
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 14 },
  search: {
    minHeight: 44,
    borderRadius: RADIUS.control,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
  },
  input: { minHeight: 44, fontSize: 16 },
  hint: { fontSize: 13.5 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.card,
    overflow: 'hidden',
  },
  row: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
  },
  rowText: { flex: 1, gap: 3 },
  title: { fontSize: 16, fontWeight: '600' },
  detail: { fontSize: 13.5 },
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  badgeText: { fontSize: 11.5, fontWeight: '700' },
  loading: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  empty: {
    minHeight: 150,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  emptyText: { fontSize: 15, textAlign: 'center' },
  clear: {
    minHeight: 42,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.control,
    paddingHorizontal: 16,
  },
})
