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
import { useTokens } from '../../theme/tokens'
import { Card } from '../../ui/card'
import { SectionLabel } from '../../ui/section-label'
import { taskSections, useTaskList } from './store'
import { CompletedToggle, TaskComposer, TaskRow } from './TaskRow'
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
  const [completedOpen, setCompletedOpen] = useState(false)
  const [toggleFailed, setToggleFailed] = useState(false)

  // Writable until the list says otherwise, so the composer is there at once.
  const writable = list ? list.writable : true
  const { active, completed } = taskSections(tasks)
  const row = (task: Task) => (
    <TaskRow
      key={task.id}
      task={task}
      writable={writable}
      last={false}
      onToggled={(ok) => setToggleFailed(!ok)}
    />
  )

  return (
    <View style={styles.wrap}>
      <SectionLabel>{title}</SectionLabel>

      <Card>
        {active.map(row)}

        {completed.length > 0 ? (
          <>
            <CompletedToggle
              count={completed.length}
              open={completedOpen}
              onPress={() => setCompletedOpen((open) => !open)}
            />
            {completedOpen ? completed.map(row) : null}
          </>
        ) : null}

        {writable ? (
          <TaskComposer listId={listId} placeholder={addLabel} />
        ) : (
          <View style={styles.readOnly}>
            <Text style={[styles.readOnlyText, { color: tokens.muted }]}>
              {readOnlyReason ?? ''}
            </Text>
          </View>
        )}
      </Card>

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
  readOnly: { minHeight: 50, justifyContent: 'center' },
  readOnlyText: { fontSize: 13, lineHeight: 19, paddingVertical: 10 },
  note: { fontSize: 14, paddingHorizontal: 2 },
})
