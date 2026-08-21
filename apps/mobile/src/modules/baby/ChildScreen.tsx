/**
 * A Child's log — the Module's root, and the screen the design settled on.
 *
 * Three ideas, each from a different direction that was prototyped
 * (`prototype/mobile-baby-log-screen`):
 *
 * - **The tiles are the last-used actions.** They answer "how is today going"
 *   and tapping one logs that type again. Status and shortcut in one control,
 *   ordered by how recently each type was used.
 * - **The log bar is everything this Child tracks**, in the Child's own order,
 *   whether or not each has been used lately — and holding one down is where
 *   that order gets rearranged, because the bar is the only place a person can
 *   see what they are arranging. Past the divider at its end sit the two things
 *   that are *not* log entries — a to-do and a question — because those are
 *   what a parent thinks of while logging and would otherwise navigate away to
 *   write down. `LogBar` owns all of it.
 * - **The chart is a real card**, not a sparkline squeezed into a tile.
 *
 * There is no list-of-children screen in front of this: the name in the header
 * is a switcher, and which Child is selected is remembered per Group on this
 * phone. A redirect from a list to "the only child" would be a back-button
 * loop, which is why selection is a preference and never a navigation step.
 */

import { formatAge } from '@gather/core/baby-age'
import {
  BABY_BAR_SHORTCUTS,
  BABY_EVENT_TYPES,
  type BabyBarSlot,
  type BabyEventType,
  declinedEventTypes,
  isBabyBarShortcut,
} from '@gather/core/domain'
import { moduleById, moduleText } from '@gather/core/modules'
import { useMutation } from 'convex/react'
import { Image } from 'expo-image'
import { Stack, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { fmt, useI18n } from '../../i18n'
import { UI_ICONS } from '../../theme/icons'
import { RADIUS, useTokens } from '../../theme/tokens'
import { ChildSwitcher } from './ChildSwitcher'
import { useMinuteClock } from './clock'
import { FirstRun } from './FirstRun'
import { BABY_UI_ICONS, EVENT_ICONS } from './icons'
import { LogBar } from './LogBar'
import { hideSlot, showAllSlots } from './logBarState'
import { type BabyBase, babyHref } from './paths'
import { type QuickListKind, QuickListSheet } from './QuickListSheet'
import { QuickLogSheet } from './QuickLogSheet'
import { sheetHandles } from './sheetFields'
import { TrendCard } from './TrendCard'
import { tileStatus, tileTypes } from './todayStatus'
import { useBabyLog } from './useBabyLog'

export interface ChildScreenProps {
  /** Which tab stack this instance is mounted in (ADR-0023). */
  base: BabyBase
}

export function ChildScreen({ base }: ChildScreenProps) {
  const tokens = useTokens('home')
  const { t, locale } = useI18n()
  const router = useRouter()
  const log = useBabyLog()
  const updateChild = useMutation(api.babies.update)
  const removeChild = useMutation(api.babies.remove)
  const [switching, setSwitching] = useState(false)
  const [logging, setLogging] = useState<BabyEventType | null>(null)
  const [listing, setListing] = useState<QuickListKind | null>(null)

  const now = useMinuteClock()
  const events = useMemo(() => log.events ?? [], [log.events])
  const tiles = useMemo(
    () => tileTypes(log.tracked, events),
    [log.tracked, events],
  )

  if (log.loading)
    return (
      <View style={{ flex: 1, backgroundColor: tokens.bg }}>
        <LoadingSkeleton rows={5} label={t.actions.loading} />
      </View>
    )
  if (!log.child) return <FirstRun base={base} groupName={log.groupName} />

  const child = log.child
  // The Module's own name, from the shared catalogue: the header must not
  // invent a second word for a Module the rest of the app already names.
  const babyModule = moduleById('baby-log')
  const moduleLabel = babyModule ? moduleText(babyModule, t).label : ''
  const age = formatAge(child.birthDate, t.baby.log.child.age, locale, now)
  const tint = tokens.tintOf('home')

  const statusMessages = {
    ago: (duration: string) => fmt(t.baby.log.status.ago, { duration }),
    countToday: (count: number) => fmt(t.baby.log.status.countToday, { count }),
    never: t.baby.log.status.never,
    at: (time: string) => fmt(t.baby.log.status.at, { time }),
    // The app's language, not the device's: this app has its own language
    // toggle, and a tile that formats in one while its label reads in the
    // other looks like a bug (ADR-0011).
    formatTime: (timestamp: number) =>
      new Date(timestamp).toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
      }),
  }

  /**
   * The bar's new arrangement, written to the same ordered `barOrder` the
   * settings screen writes: one arrangement, two places to change it. It is a
   * different field from `untrackedTypes` because it answers a different
   * question — *where* each button sits, and whether the two shortcuts are on
   * the bar — and `babyBarSlots` reconciles the two so neither can contradict
   * the other (ADR-0022).
   *
   * `babies.update` takes name and birth date as required arguments, so they
   * are resent unchanged.
   */
  function reorder(next: BabyBarSlot[]) {
    updateChild({
      id: child._id as Id<'babies'>,
      groupSlug: log.groupSlug,
      name: child.name,
      birthDate: child.birthDate,
      barOrder: next,
    })
  }

  function saveSlots(next: BabyBarSlot[]) {
    updateChild({
      id: child._id as Id<'babies'>,
      groupSlug: log.groupSlug,
      name: child.name,
      birthDate: child.birthDate,
      untrackedTypes: declinedEventTypes(
        next.filter((slot): slot is BabyEventType => !isBabyBarShortcut(slot)),
      ),
      barOrder: next,
    })
  }

  /**
   * One way to log, whatever the type: the sheet asks with chips where there is
   * a closed set and with a text box where there is not, so nothing falls
   * through to a second screen.
   */
  function openLog(type: BabyEventType) {
    if (sheetHandles(type)) setLogging(type)
  }

  function confirmChildDelete(childToDelete: { _id: string; name: string }) {
    Alert.alert(
      fmt(t.baby.log.form.deleteTitle, { name: childToDelete.name }),
      t.baby.log.form.deleteBody,
      [
        { text: t.actions.cancel, style: 'cancel' },
        {
          text: fmt(t.baby.log.form.deleteConfirm, {
            name: childToDelete.name,
          }),
          style: 'destructive',
          onPress: () =>
            removeChild({
              id: childToDelete._id as Id<'babies'>,
              groupSlug: log.groupSlug,
            }),
        },
      ],
    )
  }

  /** A press on the bar, whichever kind of button it was. */
  function pick(slot: BabyBarSlot) {
    if (slot === 'todo' || slot === 'question') {
      setListing(slot)
      return
    }
    openLog(slot)
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: moduleLabel }} />
      {/* First view in the screen, deliberately: UIKit only honours
        `contentInsetAdjustmentBehavior="automatic"` — and so only collapses the
        large title against a scroll view — when that scroll view is the *first*
        subview of the screen's root. Wrapping this in a flex `View` to sit the
        `LogBar` under it is what left this title stuck big while the Timeline's
        collapsed. `LogBar` paints its own background, so the wrapper bought
        nothing. */}
      <ScrollView
        style={[styles.fill, { backgroundColor: tokens.bg }]}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.baby.log.child.switch}
          onPress={() => setSwitching(true)}
          style={({ pressed }) => [styles.identity, pressed && styles.pressed]}
        >
          {child.photoUrl ? (
            <Image
              source={{ uri: child.photoUrl }}
              style={styles.avatar}
              contentFit="cover"
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View style={[styles.avatar, { backgroundColor: tint.bg }]}>
              <BABY_UI_ICONS.Baby size={27} color={tint.fg} strokeWidth={1.7} />
            </View>
          )}
          <View style={styles.identityText}>
            <View style={styles.nameRow}>
              <Text style={[styles.name, { color: tokens.fg }]}>
                {child.name}
              </Text>
              <UI_ICONS.ChevronDown
                size={19}
                color={tokens.muted}
                strokeWidth={2.4}
              />
            </View>
            <Text style={[styles.age, { color: tokens.muted }]}>{age}</Text>
          </View>
        </Pressable>

        <Text style={[styles.sectionTitle, { color: tokens.muted }]}>
          {t.baby.log.status.today.toUpperCase()}
        </Text>

        <View style={styles.tiles}>
          {tiles.map((type) => {
            const status = tileStatus(type, events, now, statusMessages)
            const Icon = EVENT_ICONS[type]
            return (
              <Pressable
                key={type}
                accessibilityRole="button"
                accessibilityLabel={fmt(t.baby.log.entry.logTitle, {
                  type: t.baby.eventTypes[type],
                })}
                onPress={() => openLog(type)}
                style={({ pressed }) => [
                  styles.tile,
                  {
                    backgroundColor: tokens.surface,
                    borderColor: tokens.border,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.tileHead}>
                  <Icon size={17} color={tint.fg} strokeWidth={1.9} />
                  <Text
                    numberOfLines={1}
                    style={[styles.tileLabel, { color: tokens.muted }]}
                  >
                    {t.baby.eventTypes[type].toUpperCase()}
                  </Text>
                </View>
                <Text style={[styles.tileValue, { color: tokens.fg }]}>
                  {status.headline ?? '—'}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[styles.tileDetail, { color: tokens.muted }]}
                >
                  {status.detail ?? ''}
                </Text>
              </Pressable>
            )
          })}
        </View>

        <TrendCard
          events={events}
          title={t.baby.log.status.weight}
          onOpenAll={() =>
            router.push(babyHref(base, '/trends', { childId: child._id }))
          }
        />

        <Text style={[styles.sectionTitle, { color: tokens.muted }]}>
          {t.baby.log.lists.title.toUpperCase()}
        </Text>

        <View
          style={[
            styles.card,
            { backgroundColor: tokens.surface, borderColor: tokens.border },
          ]}
        >
          {(
            [
              ['todos', t.baby.log.lists.todos, BABY_UI_ICONS.ListChecks],
              [
                'questions',
                t.baby.log.lists.questions,
                BABY_UI_ICONS.CircleQuestionMark,
              ],
            ] as const
          ).map(([list, label, Icon], index) => (
            <Pressable
              key={list}
              accessibilityRole="button"
              accessibilityLabel={label}
              onPress={() =>
                router.push(
                  babyHref(base, '/lists', { childId: child._id, list }),
                )
              }
              style={({ pressed }) => [
                styles.row,
                index > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: tokens.border,
                },
                pressed && styles.pressed,
              ]}
            >
              <Icon size={18} color={tint.fg} strokeWidth={1.9} />
              <Text style={[styles.rowLabel, { color: tokens.fg }]}>
                {label}
              </Text>
              <UI_ICONS.ChevronRight
                size={18}
                color={tokens.muted}
                strokeWidth={2.2}
              />
            </Pressable>
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push(babyHref(base, '/timeline', { childId: child._id }))
          }
          style={({ pressed }) => [styles.seeAll, pressed && styles.pressed]}
        >
          <Text style={[styles.seeAllText, { color: tint.fg }]}>
            {fmt(t.baby.log.status.seeAll, { count: events.length })}
          </Text>
        </Pressable>
      </ScrollView>

      <LogBar
        slots={log.slots}
        onPick={pick}
        onReorder={reorder}
        onHide={(slot) => saveSlots(hideSlot(log.slots, slot))}
        onShowAll={() =>
          saveSlots(
            showAllSlots(log.slots, BABY_EVENT_TYPES, BABY_BAR_SHORTCUTS),
          )
        }
      />

      {switching ? (
        <ChildSwitcher
          items={log.children ?? []}
          selectedId={child._id}
          onSelect={(id) => {
            log.selectChild(id)
            setSwitching(false)
          }}
          onEdit={(id) => {
            setSwitching(false)
            router.push(babyHref(base, '/settings', { childId: id }))
          }}
          onDelete={(id) => {
            const childToDelete = log.children?.find((item) => item._id === id)
            if (childToDelete) confirmChildDelete(childToDelete)
          }}
          onAdd={() => {
            setSwitching(false)
            router.push(babyHref(base, '/new'))
          }}
          onClose={() => setSwitching(false)}
        />
      ) : null}

      {listing ? (
        <QuickListSheet
          kind={listing}
          babyId={child._id as Id<'babies'>}
          listId={
            (listing === 'todo' ? child.taskListId : child.questionsListId) as
              | Id<'taskLists'>
              | undefined
          }
          groupSlug={log.groupSlug}
          childName={child.name}
          onClose={() => setListing(null)}
        />
      ) : null}

      {logging ? (
        <QuickLogSheet
          babyId={child._id as Id<'babies'>}
          childName={child.name}
          groupSlug={log.groupSlug}
          type={logging}
          tracked={log.tracked}
          previous={events}
          onClose={() => setLogging(null)}
        />
      ) : null}
    </>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20, gap: 9 },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    marginBottom: 6,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityText: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { fontSize: 27, fontWeight: '700', letterSpacing: -0.7 },
  age: { fontSize: 13 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 6,
  },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    // Two per row at every phone width, without measuring: half the content
    // box minus half the gap.
    flexBasis: '48%',
    flexGrow: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.card,
    padding: 12,
    gap: 5,
  },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  tileLabel: { flex: 1, fontSize: 12, fontWeight: '700', letterSpacing: 0.4 },
  tileValue: { fontSize: 24, fontWeight: '700', letterSpacing: -0.6 },
  tileDetail: { fontSize: 12.5 },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.card,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
  rowLabel: { flex: 1, fontSize: 16 },
  seeAll: { alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  seeAllText: { fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.6 },
})
