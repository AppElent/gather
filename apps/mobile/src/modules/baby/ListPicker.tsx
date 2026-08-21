/**
 * One of a Child's two checklist slots: a new list named after them, or an
 * existing one out of the same Group.
 *
 * The picker offers **any** list in the Group, whatever provider it runs on —
 * Tasks already presents one model across backends, and a baby-only "local
 * lists only" rule would be an invention nobody could explain (ADR-0021). What
 * it does instead is tell the truth *before* the choice: a list Gather may only
 * read says so where it is picked, not later when an add fails.
 */
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { fmt, useI18n } from '../../i18n'
import { UI_ICONS } from '../../theme/icons'
import { RADIUS, useTokens } from '../../theme/tokens'

export type PickedList =
  | { kind: 'new' }
  | { kind: 'existing'; listId: string; writable: boolean; provider: string }

export interface PickableList {
  _id: string
  name: string
  provider: 'local' | 'notion' | 'todoist'
  writable: boolean
}

export interface ListPickerProps {
  title: string
  /** What the new list would be called, shown before it exists. */
  defaultName: string
  lists: readonly PickableList[]
  value: PickedList
  onChange: (next: PickedList) => void
  groupName: string
}

export function ListPicker({
  title,
  defaultName,
  lists,
  value,
  onChange,
  groupName,
}: ListPickerProps) {
  const tokens = useTokens('home')
  const { t } = useI18n()
  const tint = tokens.tintOf('home')
  const text = t.baby.log.lists
  const [open, setOpen] = useState(false)

  const chosen =
    value.kind === 'existing'
      ? lists.find((list) => list._id === value.listId)
      : undefined
  const readOnly = value.kind === 'existing' && !value.writable

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: tokens.muted }]}>
        {title.toUpperCase()}
      </Text>

      <View
        style={[
          styles.card,
          { backgroundColor: tokens.surface, borderColor: tokens.border },
        ]}
      >
        <View style={[styles.row, { borderBottomColor: tokens.border }]}>
          <Text style={[styles.name, { color: tokens.fg }]} numberOfLines={1}>
            {chosen ? chosen.name : defaultName}
          </Text>
          <View
            style={[
              styles.badge,
              {
                backgroundColor: readOnly ? tokens.tile : tint.bg,
              },
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                { color: readOnly ? tokens.danger : tint.fg },
              ]}
            >
              {chosen ? chosen.provider : text.newList}
            </Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => setOpen((was) => !was)}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <Text style={[styles.choose, { color: tint.fg }]}>{text.choose}</Text>
          <UI_ICONS.ChevronRight
            size={18}
            color={tokens.muted}
            strokeWidth={2.2}
          />
        </Pressable>

        {open ? (
          <View style={[styles.options, { borderTopColor: tokens.border }]}>
            <Text style={[styles.hint, { color: tokens.muted }]}>
              {fmt(text.anyListIn, { group: groupName })}
            </Text>

            <Option
              label={defaultName}
              meta={fmt(text.newListHint, { name: '' }).trim()}
              selected={value.kind === 'new'}
              onPress={() => {
                onChange({ kind: 'new' })
                setOpen(false)
              }}
            />

            {lists.map((list) => (
              <Option
                key={list._id}
                label={list.name}
                meta={
                  list.writable
                    ? list.provider
                    : fmt(text.readOnly, { provider: list.provider })
                }
                warn={!list.writable}
                selected={
                  value.kind === 'existing' && value.listId === list._id
                }
                onPress={() => {
                  onChange({
                    kind: 'existing',
                    listId: list._id,
                    writable: list.writable,
                    provider: list.provider,
                  })
                  setOpen(false)
                }}
              />
            ))}
          </View>
        ) : null}
      </View>

      {readOnly && chosen ? (
        <View style={[styles.warning, { backgroundColor: tokens.tile }]}>
          <UI_ICONS.CircleAlert
            size={17}
            color={tokens.danger}
            strokeWidth={1.9}
          />
          <Text style={[styles.warningText, { color: tokens.danger }]}>
            {fmt(text.readOnlyBody, { provider: chosen.provider })}
          </Text>
        </View>
      ) : null}
    </View>
  )
}

function Option({
  label,
  meta,
  selected,
  warn,
  onPress,
}: {
  label: string
  meta: string
  selected: boolean
  warn?: boolean
  onPress: () => void
}) {
  const tokens = useTokens('home')
  const tint = tokens.tintOf('home')
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        { borderBottomColor: tokens.border },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.optionText}>
        <Text style={[styles.optionName, { color: tokens.fg }]}>{label}</Text>
        <Text
          style={[
            styles.optionMeta,
            { color: warn ? tokens.danger : tokens.muted },
          ]}
        >
          {meta}
        </Text>
      </View>
      {selected ? (
        <UI_ICONS.Check size={19} color={tint.fg} strokeWidth={2.4} />
      ) : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  title: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.card,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 54,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'transparent',
  },
  name: { flex: 1, fontSize: 16.5, fontWeight: '600' },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.3 },
  choose: { flex: 1, fontSize: 15.5 },
  options: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  hint: { fontSize: 13, lineHeight: 19, paddingBottom: 6 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 54,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionText: { flex: 1, gap: 2 },
  optionName: { fontSize: 16, fontWeight: '600' },
  optionMeta: { fontSize: 12.5 },
  warning: {
    flexDirection: 'row',
    gap: 9,
    padding: 10,
    borderRadius: RADIUS.control,
  },
  warningText: { flex: 1, fontSize: 13, lineHeight: 19 },
  pressed: { opacity: 0.6 },
})
