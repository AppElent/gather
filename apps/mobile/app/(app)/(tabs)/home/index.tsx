/**
 * Home: "Today" (Tiles & Today). It answers "what now" before "where is my
 * stuff", and builds only what has data (the Step 0 inventory):
 *
 * - **Header.** The Group's name is the native large title, with the date and
 *   the Member count under it. Switch Group and Settings are bar buttons, so
 *   the platform draws them in glass.
 * - **Now card,** only while a local task is past its due date.
 * - **Today rail:** today's baby log entries, then the Now capsule. Nothing
 *   upcoming has a time on a live Module, so there is no upcoming section.
 * - **Anytime today:** local tasks due today, tickable where they stand.
 * - **Pinned:** this phone's Pins (ADR-0033), as group-fill cards.
 *
 * A part with nothing to show is absent, never an empty state.
 *
 * ADR-0015 still holds: there is no Group line in chrome, so naming the Group
 * and switching it are Home's job. The switch is a bar button now that the
 * name is the system's title, and it opens the same ephemeral sheet.
 *
 * It also hides the splash: on a cold start with a retained session this is the
 * first screen mounted.
 */

import {
  clockTime,
  overdueListCount,
  overdueListId,
  spelledDate,
} from '@gather/core/home-today'
import { moduleText } from '@gather/core/modules'
import { router, Stack } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAvailability } from '../../../../src/availability/AvailabilityProvider'
import { useGroup } from '../../../../src/group/GroupProvider'
import { useToday } from '../../../../src/home/use-today'
import { fmt, plural, useI18n } from '../../../../src/i18n'
import { EVENT_ICONS } from '../../../../src/modules/baby/icons'
import { moduleDestination } from '../../../../src/modules/moduleDestination'
import { TaskRow } from '../../../../src/modules/tasks/TaskRow'
import { useTaskSheets } from '../../../../src/modules/tasks/taskMenu'
import { useModuleArrangement } from '../../../../src/prefs/moduleArrangement'
import { GroupSwitcherSheet } from '../../../../src/shell/GroupSwitcherSheet'
import { UI_ICONS } from '../../../../src/theme/icons'
import { SPACE, TYPE, useTokens } from '../../../../src/theme/tokens'
import { HeaderIconButton } from '../../../../src/ui/header-icon-button'
import { InsetList } from '../../../../src/ui/inset-list'
import { moduleTile } from '../../../../src/ui/module-tile'
import { NowCard } from '../../../../src/ui/now-card'
import { PinnedCard, PinnedRow } from '../../../../src/ui/pinned-card'
import { washScreenOptions } from '../../../../src/ui/screen-header'
import { TodayRail } from '../../../../src/ui/today-rail'
import { useHideSplash } from '../../../../src/useHideSplash'

export default function Home() {
  const tokens = useTokens()
  const { t, locale } = useI18n()
  const insets = useSafeAreaInsets()
  const { group } = useGroup()
  const { serviceActionsEnabled } = useAvailability()
  const onLayout = useHideSplash()
  const [switching, setSwitching] = useState(false)
  const today = useToday()
  const arrangement = useModuleArrangement(group.slug)
  const taskSheets = useTaskSheets({ tasks: today.tasks })
  const words = t.shell.home.today

  const listOf = (id: string) => today.lists.find((list) => list.id === id)
  const tasksTile = moduleTile('tasks')

  const byline = [
    spelledDate(today.now, locale, words.date),
    today.memberCount === undefined
      ? null
      : plural(locale, today.memberCount, words.members),
  ]
    .filter(Boolean)
    .join(' · ')

  const nowCard = (() => {
    if (today.overdue.length === 0 || !tasksTile) return null
    const listId = overdueListId(today.overdue)
    const list = listId ? listOf(listId) : undefined
    return (
      <NowCard
        testID="home-now"
        group={tasksTile.group}
        glyph={tasksTile.glyph}
        caption={words.overdue.caption}
        value={String(today.overdue.length)}
        detail={
          list
            ? fmt(words.overdue.inList, { list: list.name })
            : fmt(words.overdue.acrossLists, {
                count: overdueListCount(today.overdue),
              })
        }
        action={{
          testID: 'home-now-action',
          label: list
            ? fmt(words.overdue.openList, { list: list.name })
            : words.overdue.openTasks,
          // With the All index beneath it, so it has a back button (APP-458).
          onPress: () =>
            router.push(
              list
                ? { pathname: '/all/tasks/[listId]', params: { listId: list.id } }
                : moduleDestination('tasks'),
              { withAnchor: true },
            ),
        }}
      />
    )
  })()

  const pinned = arrangement.arrangement.pinned.flatMap((module) => {
    const tile = moduleTile(module.id)
    return tile ? [{ module, tile }] : []
  })

  return (
    <>
      <Stack.Screen
        options={{
          // The same transparent large-title bar as a Module screen, over
          // `ground` instead of a wash.
          ...washScreenOptions(group.name),
          headerLeft: () => (
            <HeaderIconButton
              testID="home-switch-group"
              label={fmt(t.shell.home.switchFrom, {
                group: group.name,
                action: t.shell.switcher.action,
              })}
              disabled={!serviceActionsEnabled}
              onPress={() => setSwitching(true)}
            >
              <UI_ICONS.Users size={22} color={tokens.ink} strokeWidth={2} />
            </HeaderIconButton>
          ),
          headerRight: () => (
            <HeaderIconButton
              testID="home-settings"
              label={t.shell.openSettings}
              onPress={() => router.navigate('/settings')}
            >
              <UI_ICONS.Settings size={22} color={tokens.ink} strokeWidth={2} />
            </HeaderIconButton>
          ),
        }}
      />
      <ScrollView
        onLayout={onLayout}
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: tokens.ground }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + SPACE[6] },
        ]}
      >
        <Text
          testID="home-byline"
          style={[styles.byline, styles.gutter, { color: tokens.muted }]}
        >
          {byline}
        </Text>

        {nowCard ? <View style={styles.gutter}>{nowCard}</View> : null}

        {today.rail.length > 0 ? (
          <View style={[styles.section, styles.gutter]}>
            <Heading>{words.heading}</Heading>
            <TodayRail
              testID="home-rail"
              items={today.rail.map((entry) => ({
                id: entry.id,
                time: clockTime(entry.timestamp),
                group: 'home',
                glyph: EVENT_ICONS[entry.type],
                title: entry.line,
              }))}
              now={fmt(words.now, { time: clockTime(today.now) })}
            />
          </View>
        ) : null}

        {today.dueToday.length > 0 ? (
          <View style={[styles.section, styles.gutter]}>
            <Heading>{words.anytime}</Heading>
            <InsetList testID="home-anytime">
              {today.dueToday.map((task) => {
                const list = listOf(task.listId)
                return (
                  <TaskRow
                    key={task.id}
                    task={task}
                    writable={list?.writable ?? false}
                    chevron
                    meta={
                      list ? (
                        <Text style={[styles.meta, { color: tokens.muted }]}>
                          {fmt(t.tasks.inList, { list: list.name })}
                        </Text>
                      ) : null
                    }
                    onOpen={() =>
                      router.push(
                        {
                          pathname: '/all/tasks/task/[taskId]',
                          params: { taskId: task.id },
                        },
                        { withAnchor: true },
                      )
                    }
                    menu={{
                      reorder: false,
                      onAction: (action) => taskSheets.onAction(task, action),
                    }}
                  />
                )
              })}
            </InsetList>
          </View>
        ) : null}

        {pinned.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.gutter}>
              <Heading>{words.pinned}</Heading>
            </View>
            <PinnedRow accessibilityLabel={words.pinned}>
              {pinned.map(({ module, tile }) => (
                <PinnedCard
                  key={module.id}
                  testID={`home-pinned-${module.id}`}
                  title={moduleText(module, t).label}
                  face={tile}
                  onPress={() => router.push(moduleDestination(module.id))}
                  menu={{
                    actions: [
                      {
                        id: 'open',
                        title: words.open,
                        image: 'arrow.up.forward',
                      },
                      { id: 'unpin', title: words.unpin, image: 'pin.slash' },
                    ],
                    onAction: (action) => {
                      if (action === 'open') {
                        router.push(moduleDestination(module.id))
                      }
                      if (action === 'unpin') {
                        arrangement.togglePinned(module.id)
                      }
                    },
                  }}
                />
              ))}
            </PinnedRow>
          </View>
        ) : null}
      </ScrollView>

      {taskSheets.sheets}
      {switching ? (
        <GroupSwitcherSheet onClose={() => setSwitching(false)} />
      ) : null}
    </>
  )
}

function Heading({ children }: { children: string }) {
  const tokens = useTokens()
  return (
    <Text accessibilityRole="header" style={[styles.heading, { color: tokens.ink }]}>
      {children}
    </Text>
  )
}

const styles = StyleSheet.create({
  content: { gap: SPACE[5] },
  gutter: { paddingHorizontal: SPACE[4] },
  byline: { ...TYPE.subhead },
  section: { gap: SPACE[2] },
  heading: { ...TYPE.title2, paddingHorizontal: SPACE[1] },
  meta: { ...TYPE.footnote },
})
