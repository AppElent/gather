/**
 * Search over one Group, with the field the platform draws rather than one we
 * do. `Stack.SearchBar` is UIKit's `UISearchController`: on iOS 26 it docks
 * above the keyboard with its own cancel capsule beside it, and on Android the
 * same declaration renders the top search bar that platform expects. What
 * fills the screen under it is ours; the field, the clear button, the cancel,
 * the keyboard dance and Dynamic Type are not.
 */

import { todayIn } from '@gather/core/civil-date'
import { STATUS_VALUES, WHEN_VALUES } from '@gather/core/search-filters'
import { deviceTimeZone } from '@gather/core/time-zones'
import {
  Stack,
  useIsFocused,
  useNavigation,
  usePathname,
  useRouter,
} from 'expo-router'
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
import { useHideTabBarWhile } from '../shell/tabBarVisibility'
import { UI_ICONS } from '../theme/icons'
import { RADIUS, TYPE, useTokens } from '../theme/tokens'
import { ModuleTile, moduleTile } from '../ui/module-tile'
import { SectionLabel } from '../ui/section-label'
import { useDebouncedQuery } from '../ui/use-debounced-query'
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
  searchKindOf,
  searchModulesShown,
  serverFilters,
  typesFor,
  withModule,
} from './searchFilters'
import { onSearchFocusRequest } from './searchFocus'
import {
  filtersOnArrival,
  searchOrigin,
  searchOriginModule,
} from './searchOrigin'
import {
  hrefFor,
  type QueryResult,
  recordShown,
  type SearchStack,
  toRecent,
} from './searchResults'
import { useGroupSearch } from './useGroupSearch'

const MINIMUM_QUERY = 2
const SKELETON_ROWS = 4
/** How much of Recent shows before the chevron is worth pressing. */
const COLLAPSED_RECENTS = 4

/**
 * Enough of a React Navigation navigator to find the tab bar and jump tabs.
 *
 * Hand-typed because the two things wanted here — walking up, and navigating to
 * a name computed at runtime — are both awkward against a `NavigationProp` keyed
 * to the root param list.
 */
/**
 * Whether the bottom toolbar can hold the search field: `SearchBarSlot` is
 * iOS 26 and later only, and the toolbar would otherwise be an empty bar.
 */
const TOOLBAR_SEARCH =
  Platform.OS === 'ios' &&
  Number.parseInt(String(Platform.Version).split('.')[0], 10) >= 26

type Navigator = {
  getState: () => { type?: string } | undefined
  getParent: () => Navigator | undefined
  navigate: (name: string) => void
  addListener: (
    event: 'transitionEnd',
    listener: (event: { data: { closing: boolean } }) => void,
  ) => () => void
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
 * The one search screen (APP-613). The Search tab renders it in its own
 * stack, on the Module you tapped it from or All Modules (APP-660); a Module's
 * search button pushes it inside All's stack with that Module preset. Everything the two share — the native bar, the
 * filters, the results, Recents — is here; what differs follows from `stack`:
 * where results open, what Cancel does, the tab bar, and the tab-only focus
 * wiring. The preset only seeds the Module filter.
 */
export function SearchScreen({
  stack,
  preset,
}: {
  stack: SearchStack
  preset?: SearchModuleId
}) {
  const pushed = stack === 'all'
  // A pushed search is a mode over the Module, as on the tab: keyboard up,
  // the field docked above it, no tab bar (`S613-2-InTaken`).
  const focused = useIsFocused()
  useHideTabBarWhile(pushed && focused)
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
  // The tab starts on the Module you came from (APP-660); a pushed search on
  // its preset. `applied` is the origin Module the filter was last set from,
  // so a later tap on the tab only moves the filter when you come from a
  // different place, and a Module chosen by hand survives a round trip.
  const [filters, setFilters] = useState<SearchFilters>(() =>
    initialFilters(pushed ? (preset ?? null) : searchOriginModule(group.slug)),
  )
  const applied = useRef(pushed ? null : searchOriginModule(group.slug))
  const [choosingModule, setChoosingModule] = useState(false)
  const [recents, setRecents] = useState(readRecentRecords)
  const [expanded, setExpanded] = useState(false)
  const debounced = useDebouncedQuery(text)
  const trimmed = text.trim()
  const ready = trimmed.length >= MINIMUM_QUERY
  const settled = debounced.trim() === trimmed
  const today = todayIn(group.timeZone)
  const results = useGroupSearch(
    ready && settled
      ? {
          groupSlug: group.slug,
          query: debounced,
          accepts: typesFor(filters.module, moduleShown),
          // Wines asks for wines, so beers and cheeses cannot take its 30 rows.
          kind: searchKindOf(filters.module) ?? undefined,
        }
      : null,
    serverFilters(filters, today, group.timeZone ?? deviceTimeZone()),
  )
  const members = useQuery(api.groups.members, { slug: group.slug })
  const me = useQuery(api.users.me, {})
  const modules = useMemo(() => searchModulesShown(moduleShown), [])
  const moduleLabel = filters.module
    ? t.modules.byId[filters.module].label
    : null

  // A Member chosen under Who who has since left the Group: the menu no longer
  // offers them, so the filter lets go of them too rather than narrowing by
  // someone the chip cannot show. Adjusted during render, as `held` is below.
  if (
    filters.who !== null &&
    members !== undefined &&
    !members.some((member) => member.userId === filters.who)
  )
    setFilters((current) => ({ ...current, who: null }))

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
  // look at a screen.
  useEffect(() => {
    if (!pushed && pathname === '/search') {
      const frame = requestAnimationFrame(() => searchRef.current?.focus())
      return () => cancelAnimationFrame(frame)
    }
  }, [pathname, pushed])

  // A pushed search was asked for with the magnifying glass, so it opens
  // typing too. Its field lives in the bottom toolbar, which `autoFocus` does
  // not reach, so it is focused once the push has landed — the first time
  // only: coming Back from a result is not asking to type again.
  const arrived = useRef(false)
  useEffect(() => {
    if (!pushed) return
    return navigation.addListener('transitionEnd', (event) => {
      if (event.data.closing || arrived.current) return
      arrived.current = true
      searchRef.current?.focus()
    })
  }, [navigation, pushed])

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
      // Arriving from another Module selects it; from Home, Settings or the
      // All grid, All Modules. From the same place as last time, or tapping
      // the tab while already on Search, keeps the Module the person chose.
      // The query is kept either way.
      const from = searchOriginModule(group.slug)
      const before = applied.current
      applied.current = from
      setFilters((current) => filtersOnArrival(current, before, from))
      searchRef.current?.focus()
    })
  }, [pushed, group.slug])

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
            {/* A long title gets two lines, like the detail
              under it, so rows stay close to one height (APP-941). */}
            <Text
              numberOfLines={2}
              style={[styles.title, { color: tokens.ink }]}
            >
              {record.title}
            </Text>
            {record.detail ? (
              // A note's excerpt runs up to 200 characters (APP-828); two
              // lines keep every row close to one height (APP-930).
              <Text
                numberOfLines={2}
                style={[styles.detail, { color: tokens.muted }]}
              >
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

  const filtered = shown
    ? applyFilters(shown, filters, today, group.timeZone)
    : null
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

        `placement` is left at `automatic`, which is what integrates the field
        into the bottom toolbar on iPhone. `cancelButtonText` is deprecated from
        iOS 26, where the cancel button has no text at all; it is kept for iOS
        25 and below. */}
      {/* Pushed in another tab there is no tab bar to hold the field, so the
          screen gets a bottom toolbar with the search bar's slot in it: the
          same docked field, above the keyboard (`S613-2-InTaken`). */}
      {pushed && TOOLBAR_SEARCH ? (
        <Stack.Toolbar placement="bottom">
          <Stack.Toolbar.SearchBarSlot />
        </Stack.Toolbar>
      ) : null}
      <Stack.SearchBar
        ref={searchRef}
        placeholder={
          moduleLabel
            ? fmt(t.search.placeholderModule, { module: moduleLabel })
            : t.search.placeholder
        }
        cancelButtonText={t.common.actions.cancel}
        autoFocus
        autoCapitalize="none"
        hideNavigationBar={false}
        // Without the toolbar slot (Android, iOS before 26), `automatic` would
        // draw no field on a pushed screen, so it sits under the title.
        placement={pushed && !TOOLBAR_SEARCH ? 'stacked' : undefined}
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
