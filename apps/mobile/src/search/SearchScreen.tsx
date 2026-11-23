/**
 * Search over one Group, with the field the platform draws rather than one we
 * do. `Stack.SearchBar` is UIKit's `UISearchController`: on iOS 26 it docks
 * above the keyboard with its own cancel capsule beside it, and on Android the
 * same declaration renders the top search bar that platform expects. What
 * fills the screen under it is ours; the field, the clear button, the cancel,
 * the keyboard dance and Dynamic Type are not.
 */

import { localIsoDate } from '@gather/core/civil-date'
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
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { api } from '../convex/api'
import { useQuery } from '../convex/queries'
import { useGroup } from '../group/GroupProvider'
import { fmt, useI18n } from '../i18n'
import { moduleShown } from '../modules/buildModules'
import { UI_ICONS } from '../theme/icons'
import { RADIUS, TYPE, useTokens } from '../theme/tokens'
import { ModuleTile, moduleTile } from '../ui/module-tile'
import { SectionLabel } from '../ui/section-label'
import { FilterChipRow, MenuChip, type MenuChoice, ModuleChip } from './FilterChips'
import { ModuleSheet } from './ModuleSheet'
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
import {
  applyFilters,
  groupByModule,
  initialFilters,
  moduleFilters,
  moduleOf,
  narrowed,
  type SearchFilters,
  type SearchModuleId,
  STATUS_VALUES,
  searchModulesShown,
  typesFor,
  WHEN_VALUES,
  withModule,
} from './searchFilters'
import { onSearchFocusRequest } from './searchFocus'
import { searchOrigin } from './searchOrigin'
import {
  hrefFor,
  type QueryResult,
  recordShown,
  toRecent,
} from './searchResults'

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

/** "Any" in a filter's menu: the choice that clears it. */
const ANY = 'any'

/**
 * The one search screen (APP-613). The Search tab renders it with no preset
 * (All Modules); a Module's search button pushes it inside All's stack with
 * that Module preset. Everything the two share — the native bar, the filters,
 * the results, Recents — is here; what differs is where results open, what
 * Cancel does and the tab-only focus wiring.
 */
export function SearchScreen({ preset }: { preset?: SearchModuleId } = {}) {
  const pushed = preset !== undefined
  const stack = pushed ? 'all' : 'search'
  const { group } = useGroup()
  const { t } = useI18n()
  const words = t.search.filters
  // No group: Search is a front door and belongs to no Module, so it takes ink
  // rather than a tint (ADR-0017).
  const tokens = useTokens()
  const router = useRouter()
  const pathname = usePathname()
  const navigation = useNavigation<Navigator>()
  const searchRef = useRef<SearchBarCommands>(null)
  const [text, setText] = useState('')
  const [filters, setFilters] = useState<SearchFilters>(() =>
    initialFilters(preset ?? null),
  )
  const [choosingModule, setChoosingModule] = useState(false)
  const [recents, setRecents] = useState(readRecentRecords)
  const [expanded, setExpanded] = useState(false)
  const debounced = useDebouncedQuery(text)
  const trimmed = text.trim()
  const ready = trimmed.length >= MINIMUM_QUERY
  const settled = debounced.trim() === trimmed
  const results = useQuery(
    api.search.group,
    ready && settled
      ? {
          groupSlug: group.slug,
          query: debounced,
          accepts: typesFor(filters.module, moduleShown),
        }
      : 'skip',
  )
  const members = useQuery(api.groups.members, { slug: group.slug })
  const me = useQuery(api.users.me, {})
  const modules = useMemo(() => searchModulesShown(moduleShown), [])
  const moduleLabel = filters.module
    ? t.modules.byId[filters.module].label
    : null

  const groupRecents = useMemo(
    () =>
      recordsForGroup(recents, group.slug).filter(
        (record) =>
          recordShown(record, moduleShown) &&
          // A recent knows its Module and nothing else the filters read.
          (!filters.module || moduleOf(record) === filters.module),
      ),
    [group.slug, recents, filters.module],
  )

  /**
   * What is on screen, which is not what the current query has answered.
   * Convex answers `undefined` for a query it has not seen before, and every
   * keystroke past the debounce is a new query — so the rows would be replaced
   * by a skeleton on the way to the next rows, which is the flicker the
   * interaction rules forbid. Holding the last answer is what stops that.
   * A Module change is a new query too; the held rows are filtered by the new
   * Module meanwhile, so nothing from the old one shows.
   *
   * Adjusted during render rather than in an effect: React re-runs the
   * component before committing, so there is no second paint to see.
   */
  const [held, setHeld] = useState<QueryResult[] | null>(null)
  if (results !== undefined && results !== held) setHeld(results)
  if (!ready && held !== null) setHeld(null)
  const shown = results ?? held

  // Arriving from another tab. Selecting Search means asking to type, not to
  // look at a screen. A pushed search focuses through `autoFocus` on mount.
  useEffect(() => {
    if (!pushed && pathname === '/search') {
      const frame = requestAnimationFrame(() => searchRef.current?.focus())
      return () => cancelAnimationFrame(frame)
    }
  }, [pathname, pushed])

  /**
   * The Search tab was tapped — from anywhere, including from Search itself.
   *
   * Two things hang off it. **Focus**, for Android, where dismissing search
   * collapses the view in place and leaves the pathname untouched, so the
   * effect above cannot fire and the field would stay shut for good. And **the
   * re-read**, because recents are written by `useRecordRecent` on detail
   * screens in other tabs, and this stack stays mounted, so it does not remount
   * on the way back — without it the list would only ever show what Search
   * itself opened. One synchronous `kv-store` read, which is what that store is
   * for. A search pushed in All is not the tab's, so it does not listen.
   */
  useEffect(() => {
    if (pushed) return
    return onSearchFocusRequest(() => {
      setRecents(readRecentRecords())
      searchRef.current?.focus()
    })
  }, [pushed])

  const clear = () => {
    setText('')
    searchRef.current?.clearText()
  }

  const clearRecents = () => {
    setRecents(clearRecentRecords(group.slug))
    setExpanded(false)
  }

  const open = (record: RecentRecordInput) => {
    const href = hrefFor(record, stack)
    if (!href) return
    saveRecentRecord(group.slug, record)
    setRecents(readRecentRecords())
    router.push(href)
  }

  const chooseModule = (module: SearchModuleId | null) =>
    setFilters((current) => withModule(current, module))

  const typeLabel = (type: SearchRecordType) => t.search.types[type]
  const rows = (
    items: readonly RecentRecordInput[],
    leading: 'badge' | 'tile',
  ) =>
    items.map((record, index) => {
      const tile = leading === 'tile' ? tileOf(record) : null
      return (
        <Pressable
          key={`${record.type}:${record.id}`}
          testID={`search-result-${record.type}-${record.id}`}
          accessibilityRole="button"
          accessibilityLabel={`${record.title}, ${typeLabel(record.type)}`}
          onPress={() => open(record)}
          android_ripple={{ color: tokens.surface2 }}
          style={({ pressed }) => [
            styles.row,
            {
              backgroundColor: tokens.surface,
              borderBottomColor: tokens.hair,
              borderBottomWidth:
                index === items.length - 1 ? 0 : StyleSheet.hairlineWidth,
            },
            pressed && { backgroundColor: tokens.surface2 },
          ]}
        >
          {tile ? (
            <ModuleTile group={tile.group} glyph={tile.glyph} size="s" />
          ) : null}
          <View style={styles.rowText}>
            <Text style={[styles.title, { color: tokens.ink }]}>
              {record.title}
            </Text>
            {record.detail ? (
              <Text style={[styles.detail, { color: tokens.muted }]}>
                {record.detail}
              </Text>
            ) : null}
          </View>
          {/* Recent mixes every Module under one header, so each row says its
            type; results carry their Module's tile instead. */}
          {leading === 'badge' ? (
            <View style={[styles.badge, { backgroundColor: tokens.surface2 }]}>
              <Text style={[styles.badgeText, { color: tokens.ink }]}>
                {typeLabel(record.type)}
              </Text>
            </View>
          ) : null}
        </Pressable>
      )
    })

  const today = localIsoDate()
  const filtered = shown ? applyFilters(shown, filters, today) : null
  const found = filtered?.map((result) => ({
    result,
    record: toRecent(result, t),
  }))
  const answered = ready && settled && results !== undefined
  const canExpand = groupRecents.length > COLLAPSED_RECENTS
  const visibleRecents =
    canExpand && !expanded
      ? groupRecents.slice(0, COLLAPSED_RECENTS)
      : groupRecents
  const Chevron = UI_ICONS.ChevronDown

  const whoChoices: MenuChoice[] = [
    { id: ANY, title: words.anyone },
    ...(me ? [{ id: me._id, title: words.me }] : []),
    ...(members ?? [])
      .filter((member) => member.userId !== me?._id)
      .map((member) => ({ id: member.userId, title: member.name })),
  ]
  const whenChoices: MenuChoice[] = [
    { id: ANY, title: words.anytime },
    ...WHEN_VALUES.map((id) => ({ id, title: words.whenValues[id] })),
  ]
  const statusChoices: MenuChoice[] = [
    { id: ANY, title: words.anyStatus },
    ...STATUS_VALUES.map((id) => ({ id, title: words.statusValues[id] })),
  ]
  const titleOf = (choices: MenuChoice[], id: string | null) =>
    id === null
      ? null
      : (choices.find((choice) => choice.id === id)?.title ?? null)

  const chips = (
    <FilterChipRow>
      <ModuleChip
        moduleLabel={moduleLabel}
        onOpen={() => setChoosingModule(true)}
        onClear={() => chooseModule(null)}
      />
      <MenuChip
        testID="search-filter-who"
        filter={words.who}
        value={titleOf(whoChoices, filters.who)}
        choices={whoChoices}
        selectedId={filters.who ?? ANY}
        onSelect={(id) =>
          setFilters((current) => ({
            ...current,
            who: id === ANY ? null : id,
          }))
        }
      />
      <MenuChip
        testID="search-filter-when"
        filter={words.when}
        value={filters.when ? words.whenValues[filters.when] : null}
        choices={whenChoices}
        selectedId={filters.when ?? ANY}
        onSelect={(id) =>
          setFilters((current) => ({
            ...current,
            when: WHEN_VALUES.find((value) => value === id) ?? null,
          }))
        }
      />
      {moduleFilters(filters.module).includes('status') ? (
        <MenuChip
          testID="search-filter-status"
          filter={words.status}
          value={filters.status ? words.statusValues[filters.status] : null}
          choices={statusChoices}
          selectedId={filters.status ?? ANY}
          onSelect={(id) =>
            setFilters((current) => ({
              ...current,
              status: STATUS_VALUES.find((value) => value === id) ?? null,
            }))
          }
        />
      ) : null}
    </FilterChipRow>
  )

  const resultsBody = () => {
    if (!found || (found.length === 0 && !answered)) {
      // The first answer for this query. A shape of the list to come, so
      // the layout does not jump when the rows land. The skeleton brings
      // its own inset, so it steps back out of the content's.
      return (
        <View testID="group-search-loading" style={styles.skeleton}>
          <LoadingSkeleton rows={SKELETON_ROWS} label={t.actions.loading} />
        </View>
      )
    }
    if (found.length === 0) {
      // Nothing at all, or nothing these filters let through: two different
      // ways back, and never an add button.
      const byFilters = narrowed(filters) && (results?.length ?? 0) > 0
      return (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: tokens.muted }]}>
            {byFilters ? words.noResults : t.search.noResults}
          </Text>
          <Pressable
            testID={byFilters ? 'search-clear-filters' : 'search-clear'}
            accessibilityRole="button"
            onPress={
              byFilters
                ? () => setFilters(initialFilters(filters.module))
                : clear
            }
            style={({ pressed }) => [
              styles.clear,
              { borderColor: tokens.hair },
              pressed && { backgroundColor: tokens.surface2 },
            ]}
          >
            <Text style={[styles.clearText, { color: tokens.ink }]}>
              {byFilters ? words.clear : t.search.clear}
            </Text>
          </Pressable>
        </View>
      )
    }
    // One Module chosen: one list, no header. All: grouped per Module.
    if (filters.module) {
      return (
        <View style={[styles.card, { borderColor: tokens.hair }]}>
          {rows(
            found.map((each) => each.record),
            'tile',
          )}
        </View>
      )
    }
    return groupByModule(
      found.map(({ result, record }) => ({ ...result, record })),
    ).map(
      (section) => (
        <View
          key={section.module}
          style={styles.section}
          testID={`search-group-${section.module}`}
        >
          <SectionLabel>{t.modules.byId[section.module].label}</SectionLabel>
          <View style={[styles.card, { borderColor: tokens.hair }]}>
            {rows(
              section.records.map((row) => row.record),
              'tile',
            )}
          </View>
        </View>
      ),
    )
  }

  const title = pushed
    ? moduleLabel
      ? fmt(t.search.inModule, { module: moduleLabel })
      : t.search.title
    : t.search.title

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerLargeTitle: true,
          title,
        }}
      />
      {/* Dismiss does not just end the search session — it leaves. On the
        tab, see `searchOrigin.ts`: iOS treats search as a mode over the page
        you were on, and a Search tab you cancel out of has nowhere to put you.
        A pushed search goes back to its Module, which is where it came from.

        `onCancelButtonPress` is `@platform ios` in react-native-screens' own
        types, so the behaviour is iOS-only for free. That asymmetry is
        deliberate: Android's search view collapses in place and its back button
        already means "leave", so navigating away there would be the wrong
        idiom. Don't "fix" it.

        `hideNavigationBar={false}` is the large title surviving an active
        field, which is the whole point of the header. Its docs warn that
        restoring native behaviour afterwards is unsupported — a one-way door
        that only matters if you stay in the room, and we don't.

        On the tab, `placement` is left at `automatic`, which is what
        integrates the field into the bottom toolbar on iPhone. A pushed search
        has no Search tab to dock into, and `automatic` draws no field there at
        all, so it stacks the field under the title and keeps it shown. `cancelButtonText` is deprecated from
        iOS 26, where the cancel button has no text at all; it is kept for iOS
        25 and below. */}
      <Stack.SearchBar
        ref={searchRef}
        placeholder={
          moduleLabel
            ? fmt(t.search.placeholderModule, { module: moduleLabel })
            : t.search.placeholder
        }
        cancelButtonText={t.common.actions.cancel}
        autoFocus
        placement={pushed ? 'stacked' : undefined}
        hideWhenScrolling={pushed ? false : undefined}
        autoCapitalize="none"
        hideNavigationBar={false}
        onChangeText={(event) => setText(event.nativeEvent.text)}
        onCancelButtonPress={() => {
          setText('')
          setExpanded(false)
          if (pushed) {
            if (router.canGoBack()) router.back()
          } else {
            tabNavigator(navigation)?.navigate(searchOrigin())
          }
        }}
      />
      <ScrollView
        style={{ backgroundColor: tokens.ground }}
        keyboardShouldPersistTaps="handled"
        // Drag the list, the keyboard goes — and on iOS the docked field comes
        // down with your finger. Android has no `interactive`.
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
      >
        {chips}
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
                    <Text style={[styles.headerAction, { color: tokens.ink }]}>
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
              <View style={[styles.card, { borderColor: tokens.hair }]}>
                {rows(visibleRecents, 'badge')}
              </View>
            </View>
          ) : (
            <Text style={[styles.hint, { color: tokens.muted }]}>
              {t.search.empty}
            </Text>
          )
        ) : (
          resultsBody()
        )}
      </ScrollView>
      {choosingModule ? (
        <ModuleSheet
          modules={modules}
          selected={filters.module}
          onSelect={chooseModule}
          onClose={() => setChoosingModule(false)}
        />
      ) : null}
    </>
  )
}

/** A result's Module tile: its group colour and glyph, from the catalogue. */
function tileOf(record: RecentRecordInput) {
  const module = moduleOf(record)
  return module ? moduleTile(module) : null
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 12, gap: 14 },
  hint: { ...TYPE.footnote },
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
  headerAction: { ...TYPE.bodyStrong },
  chevronUp: { transform: [{ rotate: '180deg' }] },
  sectionTitle: { ...TYPE.footnoteStrong },
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
  title: { ...TYPE.bodyStrong },
  detail: { ...TYPE.footnote },
  skeleton: { marginHorizontal: -16 },
  badge: {
    borderRadius: RADIUS.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  badgeText: { ...TYPE.footnoteStrong },
  empty: {
    minHeight: 150,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  emptyText: { ...TYPE.subhead, textAlign: 'center' },
  clear: {
    minHeight: 48,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 16,
  },
  clearText: { ...TYPE.bodyStrong },
})
