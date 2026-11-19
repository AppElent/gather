/**
 * A list's sections on the phone (APP-357): the Sections sheet behind the
 * list's ⋯ menu, the heading a section wears on the list, and the sheet behind
 * *Move to section* in a task's hold menu.
 *
 * The Sections sheet edits in place, as iOS Reminders does: each section is a
 * text field (rename by typing), its ⋯ moves it up or down or deletes it, and
 * the last row adds one. Deleting asks first, because the section is gone for
 * everyone, but it never takes a task with it: they move to "No section".
 */
import { MenuView } from '@expo/ui/community/menu'
import { TASK_SECTION_NAME_MAX } from '@gather/core/task-lists'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { NativeSheet } from '../../components/NativeSheet'
import { confirmDestructive } from '../../feedback/confirmDestructive'
import { haptics } from '../../feedback/haptics'
import { fmt, useI18n } from '../../i18n'
import { UI_ICONS } from '../../theme/icons'
import { TYPE, useTokens } from '../../theme/tokens'
import { SectionLabel } from '../../ui/section-label'
import { useTaskActions, useTaskLists } from './store'
import type { Task, TaskList } from './types'

/** A section's name over its inset list, read out as a heading. */
export function SectionHeading({ name }: { name: string }) {
  return (
    <View accessible accessibilityRole="header">
      <SectionLabel>{name}</SectionLabel>
    </View>
  )
}

/** Add, rename, reorder and delete a list's sections. */
export function SectionsSheet({
  list,
  onClose,
}: {
  list: TaskList
  onClose: () => void
}) {
  const tokens = useTokens('home')
  const { t } = useI18n()
  const actions = useTaskActions()
  const [draft, setDraft] = useState('')
  const sections = list.sections

  const report = (write: Promise<unknown>) =>
    write.then(
      () => haptics.itemSaved(),
      () => haptics.actionFailed(),
    )

  const add = () => {
    const name = draft.trim()
    if (!name) return
    setDraft('')
    actions.addSection(list.id, name).then(
      () => haptics.itemSaved(),
      () => {
        haptics.actionFailed()
        // A refused add (the 31st section, say) gives the name back to retype.
        setDraft((current) => current || name)
      },
    )
  }

  const move = (index: number, by: -1 | 1) => {
    const ids = sections.map((section) => section.id)
    const [lifted] = ids.splice(index, 1)
    ids.splice(index + by, 0, lifted)
    report(actions.reorderSections(list.id, ids))
  }

  const confirmDelete = (section: { id: string; name: string }) =>
    confirmDestructive({
      title: fmt(t.tasks.sections.deleteTitle, { name: section.name }),
      message: t.tasks.sections.deleteBody,
      confirm: t.common.actions.delete,
      cancel: t.common.actions.cancel,
      onConfirm: () => report(actions.deleteSection(list.id, section.id)),
    })

  return (
    <NativeSheet title={t.tasks.sections.title} onClose={onClose}>
      {sections.length === 0 ? (
        <Text style={[styles.note, { color: tokens.muted }]}>
          {t.tasks.sections.sheetEmpty}
        </Text>
      ) : null}
      {sections.map((section, index) => (
        <View
          key={section.id}
          style={[styles.row, { borderBottomColor: tokens.hair }]}
        >
          <SectionNameField
            // A rename from another phone replaces what this field holds.
            key={section.name}
            name={section.name}
            onRename={(name) =>
              report(actions.renameSection(list.id, section.id, name))
            }
          />
          <MenuView
            testID={`section-menu-${index}`}
            actions={[
              {
                id: 'up',
                title: t.tasks.sections.moveUp,
                image: 'arrow.up',
                attributes: { disabled: index === 0 },
              },
              {
                id: 'down',
                title: t.tasks.sections.moveDown,
                image: 'arrow.down',
                attributes: { disabled: index === sections.length - 1 },
              },
              {
                id: 'delete',
                title: t.tasks.sections.delete,
                image: 'trash',
                attributes: { destructive: true },
              },
            ]}
            onPressAction={({ nativeEvent }) => {
              if (nativeEvent.event === 'up') move(index, -1)
              if (nativeEvent.event === 'down') move(index, 1)
              if (nativeEvent.event === 'delete') confirmDelete(section)
            }}
          >
            <View
              accessible
              accessibilityRole="button"
              accessibilityLabel={fmt(t.tasks.sections.options, {
                name: section.name,
              })}
              hitSlop={12}
              style={styles.more}
            >
              <UI_ICONS.Ellipsis
                size={20}
                color={tokens.muted}
                strokeWidth={2.2}
              />
            </View>
          </MenuView>
        </View>
      ))}
      <View style={[styles.row, styles.lastRow]}>
        <UI_ICONS.Plus
          size={20}
          color={tokens.accentText}
          strokeWidth={2.2}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
        <TextInput
          testID="section-add"
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={add}
          // Stays open after adding, so a list's rooms go in one after another.
          submitBehavior="submit"
          maxLength={TASK_SECTION_NAME_MAX}
          placeholder={t.tasks.sections.newPlaceholder}
          placeholderTextColor={tokens.muted}
          returnKeyType="done"
          accessibilityLabel={t.tasks.sections.add}
          style={[styles.field, { color: tokens.ink }]}
        />
      </View>
      <Text style={[styles.note, { color: tokens.muted }]}>
        {t.tasks.sections.hint}
      </Text>
    </NativeSheet>
  )
}

/** A section's name, renamed by typing; an emptied field puts it back. */
function SectionNameField({
  name,
  onRename,
}: {
  name: string
  onRename: (name: string) => void
}) {
  const tokens = useTokens('home')
  const { t } = useI18n()
  const [draft, setDraft] = useState(name)
  const commit = () => {
    const next = draft.trim()
    if (!next || next === name) {
      setDraft(name)
      return
    }
    onRename(next)
  }
  return (
    <TextInput
      value={draft}
      onChangeText={setDraft}
      onEndEditing={commit}
      maxLength={TASK_SECTION_NAME_MAX}
      returnKeyType="done"
      accessibilityLabel={`${t.tasks.sections.rename}: ${name}`}
      style={[styles.field, { color: tokens.ink }]}
    />
  )
}

/** The hold menu's *Move to section*: "No section", then each section. */
export function MoveToSectionSheet({
  task,
  onClose,
}: {
  task: Task
  onClose: () => void
}) {
  const tokens = useTokens('home')
  const { t } = useI18n()
  const lists = useTaskLists()
  const actions = useTaskActions()
  const sections = lists?.find((list) => list._id === task.listId)?.sections
  const known = sections?.some((section) => section.id === task.sectionId)
  const current = known ? (task.sectionId ?? null) : null
  const options = [
    { id: null, name: t.tasks.sections.none },
    ...(sections ?? []),
  ]

  return (
    <NativeSheet title={t.tasks.sections.moveToSection} onClose={onClose}>
      {options.map((option, index) => (
        <Pressable
          key={option.id ?? 'none'}
          testID={`move-section-${option.id ?? 'none'}`}
          accessibilityRole="button"
          accessibilityState={{ selected: option.id === current }}
          accessibilityLabel={option.name}
          onPress={() => {
            onClose()
            if (option.id === current) return
            actions.setTaskSection(task.id, option.id).then(
              () => haptics.itemSaved(),
              () => haptics.actionFailed(),
            )
          }}
          style={({ pressed }) => [
            styles.row,
            index === options.length - 1 && styles.lastRow,
            { borderBottomColor: tokens.hair },
            pressed && { backgroundColor: tokens.surface2 },
          ]}
        >
          <Text style={[styles.option, { color: tokens.ink }]}>
            {option.name}
          </Text>
          {option.id === current ? (
            <UI_ICONS.Check size={18} color={tokens.ink} strokeWidth={2.6} />
          ) : null}
        </Pressable>
      ))}
    </NativeSheet>
  )
}

// The option rows of the task sheets (`sheets.tsx`), so the two read as one.
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    minHeight: 50,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lastRow: { borderBottomWidth: 0 },
  option: { ...TYPE.body, flex: 1 },
  field: { ...TYPE.body, flex: 1, paddingVertical: 12 },
  more: { padding: 8 },
  note: { ...TYPE.footnote, paddingTop: 10 },
})
