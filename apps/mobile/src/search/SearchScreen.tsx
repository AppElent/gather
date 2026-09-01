/**
 * Search over one Group, with the field the platform draws rather than one we
 * do. `Stack.SearchBar` is UIKit's `UISearchController`: on iOS 26 it docks
 * above the keyboard with its own cancel capsule beside it, and on Android the
 * same declaration renders the top search bar that platform expects. What
 * fills the screen under it is ours; the field, the clear button, the cancel,
 * the keyboard dance and Dynamic Type are not.
 */
import { useQuery } from 'convex/react'
import { Stack, useNavigation, usePathname, useRouter } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import type { SearchBarCommands } from 'react-native-screens'

import { api } from '../../../../convex/_generated/api'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { useGroup } from '../group/GroupProvider'
import { useI18n } from '../i18n'
import { UI_ICONS } from '../theme/icons'
import { RADIUS, useTokens } from '../theme/tokens'
import {
  type RecentRecordInput,
  recordsForGroup,
  type SearchRecordType,
} from './recentRecords'
import {
  clearRecentRecords,
  readRecentRecords,
  saveRecentRecord,
} from './recentRecordsStore'
import { onSearchFocusRequest } from './searchFocus'
import { searchOrigin } from './searchOrigin'
import { hrefFor, type QueryResult, toRecent } from './searchResults'

const SEARCH_DELAY_MS = 200
const MINIMUM_QUERY = 2
const SKELETON_ROWS = 4
/** How much of Recent shows before the chevron is worth pressing. */
const COLLAPSED_RECENTS = 4

function useDebouncedQuery(query: string) {
  const [debounced, setDebounced] = useState(query)
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(query), SEARCH_DELAY_MS)
    return () => clearTimeout(timeout)
  }, [query])
  return debounced
}

/**
 * Enough of a React Navigation navigator to find the tab bar and jump tabs.
 *
 * Hand-typed because the two things wanted here — walking up, and navigating to
 * a name computed at runtime — are both awkward against a `NavigationProp` keyed
 * to the root param list.
 */
type Navigator = {
  getState: () => { type?: string } | undefined
  getParent: () => Navigator | undefined
  navigate: (name: string) => void
}

/**
 * The navigator the tab bar draws, found by walking up.
 *
 * Not `useNavigation('/(app)/(tabs)')`: `NativeTabs` registers no id, so that
 * throws — *"Could not find parent navigation with route \"/(app)/(tabs)\".
 * Available routes are: '/(app)/(tabs)/search', '/(app)', '__root'"*. The tabs
 * navigator is in the chain, it just has no name to ask for, so its state's
 * `type` is the only handle on it.
 */
function tabNavigator(from: Navigator) {
  let navigator: Navigator | undefined = from
  while (navigator && navigator.getState()?.type !== 'tab') {
    navigator = navigator.getParent()
  }
  return navigator
}

export function SearchScreen() {
  const { group } = useGroup()
  const { t } = useI18n()
  // No group: Search is a front door and belongs to no Module, so it takes ink
  // rather than a tint (ADR-0017).
  const tokens = useTokens()
  const router = useRouter()
  const pathname = usePathname()
  const navigation = useNavigation<Navigator>()
  const searchRef = useRef<SearchBarCommands>(null)
  const [text, setText] = useState('')
  const [recents, setRecents] = useState(readRecentRecords)
  const [expanded, setExpanded] = useState(false)
  const debounced = useDebouncedQuery(text)
  const trimmed = text.trim()
  const ready = trimmed.length >= MINIMUM_QUERY
  const settled = debounced.trim() === trimmed
  const results = useQuery(
    api.search.group,
    ready && settled ? { groupSlug: group.slug, query: debounced } : 'skip',
  )
  const groupRecents = useMemo(
    () => recordsForGroup(recents, group.slug),
    [group.slug, recents],
  )

  /**
   * What is on screen, which is not what the current query has answered.
   * Convex answers `undefined` for a query it has not seen before, and every
   * keystroke past the debounce is a new query — so the rows would be replaced
   * by a skeleton on the way to the next rows, which is the flicker the
   * interaction rules forbid. Holding the last answer is what stops that.
   *
   * Adjusted during render rather than in an effect: React re-runs the
   * component before committing, so there is no second paint to see.
   */
  const [held, setHeld] = useState<QueryResult[] | null>(null)
  if (results !== undefined && results !== held) setHeld(results)
  if (!ready && held !== null) setHeld(null)
  const shown = results ?? held

  // Arriving from another tab. Selecting Search means asking to type, not to
  // look at a screen.
  useEffect(() => {
    if (pathname === '/search') {
      const frame = requestAnimationFrame(() => searchRef.current?.focus())
      return () => cancelAnimationFrame(frame)
    }
  }, [pathname])

  /**
   * The Search tab was tapped — from anywhere, including from Search itself.
   *
   * Two things hang off it. **Focus**, for Android, where dismissing search
   * collapses the view in place and leaves the pathname untouched, so the
   * effect above cannot fire and the field would stay shut for good. And **the
   * re-read**, because recents are written by `useRecordRecent` on detail
   * screens in other tabs, and this stack is Group-keyed so it does not remount
   * on the way back — without it the list would only ever show what Search
   * itself opened. One synchronous `kv-store` read, which is what that store is
   * for.
   */
  useEffect(
    () =>
      onSearchFocusRequest(() => {
        setRecents(readRecentRecords())
        searchRef.current?.focus()
      }),
    [],
  )

  const clear = () => {
    setText('')
    searchRef.current?.clearText()
  }

  const clearRecents = () => {
    setRecents(clearRecentRecords(group.slug))
    setExpanded(false)
  }

  const open = (record: RecentRecordInput) => {
    const href = hrefFor(record)
    if (!href) return
    saveRecentRecord(group.slug, record)
    setRecents(readRecentRecords())
    router.push(href)
  }

  const typeLabel = (type: SearchRecordType) => t.search.types[type]
  const rows = (items: readonly RecentRecordInput[]) =>
    items.map((record, index) => (
      <Pressable
        key={`${record.type}:${record.id}`}
        testID={`search-result-${record.type}-${record.id}`}
        accessibilityRole="button"
        accessibilityLabel={`${record.title}, ${typeLabel(record.type)}`}
        onPress={() => open(record)}
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
            {record.title}
          </Text>
          {record.detail ? (
            <Text
              numberOfLines={1}
              style={[styles.detail, { color: tokens.muted }]}
            >
              {record.detail}
            </Text>
          ) : null}
        </View>
        {/* The type, in Recent as well as in results: under a header that
          already says "Recent", saying it again on every row says nothing. */}
        <View style={[styles.badge, { backgroundColor: tokens.tile }]}>
          <Text style={[styles.badgeText, { color: tokens.fg }]}>
            {typeLabel(record.type)}
          </Text>
        </View>
      </Pressable>
    ))

  const found = shown?.map((result) => toRecent(result, t))
  const settledEmpty = ready && settled && results?.length === 0
  const canExpand = groupRecents.length > COLLAPSED_RECENTS
  const visibleRecents =
    canExpand && !expanded
      ? groupRecents.slice(0, COLLAPSED_RECENTS)
      : groupRecents
  const Chevron = UI_ICONS.ChevronDown

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerLargeTitle: true,
          title: t.search.title,
        }}
      />
      {/* Dismiss does not just end the search session — it leaves the tab.
        See `searchOrigin.ts`: iOS treats search as a mode over the page you
        were on, and a Search tab you cancel out of has nowhere to put you.

        `onCancelButtonPress` is `@platform ios` in react-native-screens' own
        types, so the behaviour is iOS-only for free. That asymmetry is
        deliberate: Android's search view collapses in place and its back button
        already means "leave", so navigating away there would be the wrong
        idiom. Don't "fix" it.

        `hideNavigationBar={false}` is the large title surviving an active
        field, which is the whole point of the header. Its docs warn that
        restoring native behaviour afterwards is unsupported — a one-way door
        that only matters if you stay in the room, and we don't.

        `placement` is left at `automatic`, which is what integrates the field
        into the bottom toolbar on iPhone. `cancelButtonText` is deprecated from
        iOS 26, where the cancel button has no text at all; it is kept for iOS
        25 and below. */}
      <Stack.SearchBar
        ref={searchRef}
        placeholder={t.search.placeholder}
        cancelButtonText={t.actions.cancel}
        autoFocus
        autoCapitalize="none"
        hideNavigationBar={false}
        onChangeText={(event) => setText(event.nativeEvent.text)}
        onCancelButtonPress={() => {
          setText('')
          setExpanded(false)
          tabNavigator(navigation)?.navigate(searchOrigin())
        }}
      />
      <ScrollView
        style={{ backgroundColor: tokens.bg }}
        keyboardShouldPersistTaps="handled"
        // Drag the list, the keyboard goes — and on iOS the docked field comes
        // down with your finger. Android has no `interactive`.
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
      >
        {!ready ? (
          groupRecents.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text
                  accessibilityRole="header"
                  style={[styles.sectionTitle, { color: tokens.muted }]}
                >
                  {t.search.recent}
                </Text>
                <View style={styles.sectionControls}>
                  <Pressable
                    testID="search-clear-recents"
                    accessibilityRole="button"
                    onPress={clearRecents}
                    hitSlop={8}
                    style={({ pressed }) => [
                      styles.headerControl,
                      pressed && { opacity: 0.5 },
                    ]}
                  >
                    <Text style={[styles.headerAction, { color: tokens.fg }]}>
                      {t.search.clearRecent}
                    </Text>
                  </Pressable>
                  {canExpand ? (
                    <Pressable
                      testID="search-expand-recents"
                      accessibilityRole="button"
                      accessibilityState={{ expanded }}
                      accessibilityLabel={
                        expanded ? t.actions.showLess : t.actions.showAll
                      }
                      onPress={() => setExpanded((open) => !open)}
                      hitSlop={8}
                      style={({ pressed }) => [
                        styles.headerControl,
                        pressed && { opacity: 0.5 },
                      ]}
                    >
                      <View style={expanded ? styles.chevronUp : undefined}>
                        <Chevron size={18} color={tokens.muted} />
                      </View>
                    </Pressable>
                  ) : null}
                </View>
              </View>
              <View style={[styles.card, { borderColor: tokens.border }]}>
                {rows(visibleRecents)}
              </View>
            </View>
          ) : (
            <Text style={[styles.hint, { color: tokens.muted }]}>
              {t.search.empty}
            </Text>
          )
        ) : found === null || found === undefined ? (
          // The first answer for this query. A shape of the list to come, so
          // the layout does not jump when the rows land. The skeleton brings
          // its own inset, so it steps back out of the content's.
          <View testID="group-search-loading" style={styles.skeleton}>
            <LoadingSkeleton rows={SKELETON_ROWS} label={t.actions.loading} />
          </View>
        ) : settledEmpty ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: tokens.muted }]}>
              {t.search.noResults}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.search.clear}
              onPress={clear}
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
            {rows(found)}
          </View>
        )}
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 12, gap: 14 },
  hint: { fontSize: 13.5 },
  section: { gap: 8 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionControls: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerControl: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  headerAction: { fontSize: 14, fontWeight: '600' },
  chevronUp: { transform: [{ rotate: '180deg' }] },
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
  skeleton: { marginHorizontal: -16 },
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  badgeText: { fontSize: 11.5, fontWeight: '700' },
  empty: {
    minHeight: 150,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  emptyText: { fontSize: 15, textAlign: 'center' },
  clear: {
    minHeight: 48,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.control,
    paddingHorizontal: 16,
  },
})
