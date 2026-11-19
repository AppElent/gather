/**
 * The one Member responsible for a task (APP-302): their coin on a row, the
 * Who row on the task screen, and the notice for tasks someone else gave you.
 *
 * Members come from `groups.members`, the same subscription Calendar and Home
 * read, so every row on a screen shares one. A coin is the Member's initial,
 * or two letters when two Members share one (`initialsForPeople`, as the
 * calendar marks do).
 */

import { MenuView } from '@expo/ui/community/menu'
import { initialsForPeople } from '@gather/core/calendar'
import type { TaskProviderId } from '@gather/core/domain'
import { readTaskRefusal } from '@gather/core/refusals'
import { assigneeUnavailable } from '@gather/core/task-lists'
import { useMemo } from 'react'
import { Alert, StyleSheet, Text, View } from 'react-native'

import { api } from '../../convex/api'
import { useQuery } from '../../convex/queries'
import { haptics } from '../../feedback/haptics'
import { useGroup } from '../../group/GroupProvider'
import { fmt, useI18n } from '../../i18n'
import { UI_ICONS } from '../../theme/icons'
import { SIZE, SPACE, TYPE, useTokens } from '../../theme/tokens'
import { useTaskActions } from './store'
import type { Task, TaskList } from './types'

export interface TaskPerson {
  id: string
  name: string
  initial: string
}

/** The Current Group's Members, by name, each with their coin's letters. */
export function useTaskPeople(): {
  people: readonly TaskPerson[]
  byId: ReadonlyMap<string, TaskPerson>
} {
  const { group } = useGroup()
  const members = useQuery(api.groups.members, { slug: group.slug })
  return useMemo(() => {
    const people = (members ?? []).map((m) => ({ id: m.userId, name: m.name }))
    const initials = initialsForPeople(people)
    const withInitials = people.map((person) => ({
      ...person,
      initial: initials.get(person.id) ?? '?',
    }))
    return {
      people: withInitials,
      byId: new Map(withInitials.map((person) => [person.id, person])),
    }
  }, [members])
}

/** A Member's initials in a `surface-2` disc. Decorative: rows say the name. */
export function AssigneeCoin({ initial }: { initial: string }) {
  const tokens = useTokens('home')
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[styles.coin, { backgroundColor: tokens.surface2 }]}
    >
      <Text
        maxFontSizeMultiplier={1.2}
        numberOfLines={1}
        style={[styles.coinText, { color: tokens.ink }]}
      >
        {initial}
      </Text>
    </View>
  )
}

/** A brand name, as the provider writes it. Not translated. */
const PROVIDER_NAMES: Record<TaskProviderId, string> = {
  local: 'Gather',
  notion: 'Notion',
  todoist: 'Todoist',
}

/**
 * The task screen's Who row: a native menu of the Group's current Members
 * and Nobody, showing the chosen Member's coin and name. On a list whose
 * backend cannot hold an assignee it is off, with the reason under it.
 */
export function AssigneeRow({ task, list }: { task: Task; list?: TaskList }) {
  const tokens = useTokens('home')
  const { t } = useI18n()
  const words = t.tasks.assignee
  const actions = useTaskActions()
  const { people, byId } = useTaskPeople()
  const unavailable = list ? assigneeUnavailable(list) : 'readOnly'
  const assignee = task.assigneeId ? byId.get(task.assigneeId) : undefined
  const value = assignee?.name ?? words.nobody
  const NOBODY = '__nobody__'
  // The card's other rows run edge to edge (the task screen's PropertyRow),
  // so the wrapper, menu or not, carries the line, under any reason too.
  const edge = [
    styles.edge,
    {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tokens.hair,
    },
  ]

  const row = (
    <View
      testID="detail-assignee"
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${words.who}, ${value}`}
      accessibilityState={{ disabled: unavailable !== null }}
      style={styles.row}
    >
      <UI_ICONS.User
        size={18}
        color={tokens.muted}
        strokeWidth={2}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <Text style={[styles.label, { color: tokens.ink }]}>{words.who}</Text>
      {assignee ? <AssigneeCoin initial={assignee.initial} /> : null}
      <Text numberOfLines={1} style={[styles.value, { color: tokens.muted }]}>
        {value}
      </Text>
      {unavailable === null ? (
        <UI_ICONS.ChevronDown
          size={16}
          color={tokens.muted}
          strokeWidth={2.2}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      ) : null}
    </View>
  )

  if (unavailable !== null) {
    return (
      <View style={edge}>
        {row}
        <Text style={[styles.reason, { color: tokens.muted }]}>
          {fmt(words.unavailable[unavailable], {
            provider: PROVIDER_NAMES[list?.provider ?? 'local'],
          })}
        </Text>
      </View>
    )
  }

  return (
    <MenuView
      style={edge}
      actions={[
        ...people.map((person) => ({
          id: person.id,
          title: person.name,
          state:
            person.id === task.assigneeId ? ('on' as const) : ('off' as const),
        })),
        {
          id: NOBODY,
          title: words.nobody,
          state: task.assigneeId ? ('off' as const) : ('on' as const),
        },
      ]}
      onPressAction={(event) => {
        const chosen = event.nativeEvent.event
        const next = chosen === NOBODY ? null : chosen
        if (next === (task.assigneeId ?? null)) return
        haptics.selectionChanged()
        actions.setAssignee(task.id, next).catch((error: unknown) => {
          haptics.actionFailed()
          // The one refusal the person did not cause: the Member left the
          // Group after this screen drew the menu. Anything else is a write
          // that did not land, which the unchanged row already shows.
          const refused = readTaskRefusal(error)
          if (refused) Alert.alert(words.refusals[refused])
        })
      }}
    >
      {row}
    </MenuView>
  )
}

const styles = StyleSheet.create({
  coin: {
    width: SIZE.coin,
    height: SIZE.coin,
    borderRadius: SIZE.coin / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinText: { ...TYPE.footnoteStrong },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    minHeight: SIZE.rowMin,
    paddingHorizontal: 14,
  },
  /** Out to the card's edge, as the task screen's other rows sit. */
  edge: { marginHorizontal: -14 },
  label: { ...TYPE.body, flex: 1 },
  value: { ...TYPE.subhead, maxWidth: 170, flexShrink: 1, textAlign: 'right' },
  reason: {
    ...TYPE.footnote,
    paddingHorizontal: 14,
    paddingBottom: SPACE[3],
  },
})
