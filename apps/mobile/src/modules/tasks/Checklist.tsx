/**
 * A task list, small enough to sit inside another Module.
 *
 * It takes a list id and nothing about its host, and reads and writes through
 * the Tasks store like every other list. A line ticks wherever it is pressed;
 * opening, swiping and the hold menu belong to the Tasks screens.
 *
 * A list Gather cannot write to says so and hides its composer, rather than
 * offering an input that fails on submit (ADR-0021).
 */

import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useI18n } from '../../i18n'
import { SPACE, TYPE, useTokens } from '../../theme/tokens'
import { CompletedSection } from '../../ui/completed-section'
import { InsetList } from '../../ui/inset-list'
import { SectionLabel } from '../../ui/section-label'
import { taskSections, useTaskList } from './store'
import { TaskComposer, TaskRow } from './TaskRow'
import type { Task } from './types'

export function Checklist({
  listId,
  title,
  addLabel,
  emptyLabel,
  readOnlyReason,
}: {
  listId: string
  title: string
  /** Composer placeholder — "Add a to-do" reads differently from "Add a question". */
  addLabel: string
  emptyLabel: string
  readOnlyReason?: string
}) {
  const tokens = useTokens('home')
  const { t } = useI18n()
  const { list, tasks } = useTaskList(listId)
  const [toggleFailed, setToggleFailed] = useState(false)

  // Writable until the list says otherwise, so the composer is there at once.
  const writable = list ? list.writable : true
  const { active, completed } = taskSections(tasks)
  const row = (task: Task) => (
    <TaskRow
      key={task.id}
      task={task}
      writable={writable}
      onToggled={(ok) => setToggleFailed(!ok)}
    />
  )

  return (
    <View style={styles.wrap}>
      <SectionLabel>{title}</SectionLabel>

      <InsetList>
        {active.map(row)}
        {writable ? (
          <TaskComposer listId={listId} placeholder={addLabel} />
        ) : (
          <View style={styles.readOnly}>
            <Text style={[styles.readOnlyText, { color: tokens.muted }]}>
              {readOnlyReason ?? ''}
            </Text>
          </View>
        )}
      </InsetList>

      <CompletedSection
        count={completed.length}
        group="home"
        label={t.common.completed}
      >
        <InsetList>{completed.map(row)}</InsetList>
      </CompletedSection>

      {toggleFailed ? (
        <Text style={[styles.note, { color: tokens.danger }]}>
          {t.actions.taskUpdateFailed}
        </Text>
      ) : null}

      {list?.sync === 'live' && tasks.length === 0 && writable ? (
        <Text style={[styles.note, { color: tokens.muted }]}>{emptyLabel}</Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  readOnly: {
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: SPACE[4],
  },
  readOnlyText: { ...TYPE.footnote, paddingVertical: 10 },
  note: { ...TYPE.subhead, paddingHorizontal: 2 },
})
