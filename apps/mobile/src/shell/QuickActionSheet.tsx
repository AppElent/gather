/**
 * The add tab's launcher.
 *
 * It draws nothing of its own frame. Every sheet in the app is the same
 * `NativeSheet` — one drag gesture, one scrim, one answer to the keyboard — so
 * a fix to any of those is a fix to all of them. This one only needs a Back
 * button in the heading, which is what `leading` is for.
 */
import { router } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { NativeSheet } from '../components/NativeSheet'
import { fmt, useI18n } from '../i18n'
import { moduleHref } from '../modules/moduleDestination'
import { QuickAddTask } from '../modules/tasks/QuickAddTask'
import { SubjectPickerSheet } from '../modules/tasting/SubjectPickerSheet'
import { MODULE_ICONS, UI_ICONS } from '../theme/icons'
import { RADIUS, useTokens } from '../theme/tokens'
import {
  QUICK_ACTIONS,
  type QuickAction,
  type QuickActionId,
} from './quickActions'

export function QuickActionSheet({
  visible,
  groupName,
  onClose,
}: {
  visible: boolean
  groupName: string
  onClose: () => void
}) {
  if (!visible) return null
  return <SheetBody groupName={groupName} onClose={onClose} />
}

function SheetBody({
  groupName,
  onClose,
}: {
  groupName: string
  onClose: () => void
}) {
  const tokens = useTokens()
  const { t } = useI18n()
  const [openId, setOpenId] = useState<QuickActionId | null>(null)
  // What this launcher has saved since it opened. A haptic is never the only
  // confirmation (`feedback/haptics.ts`), so each save is named here.
  const [added, setAdded] = useState<string[]>([])
  const text = t.shell.add
  const Back = UI_ICONS.ChevronLeft
  const Chevron = UI_ICONS.ChevronRight
  const openAction = QUICK_ACTIONS.find((action) => action.id === openId)
  // The tasting Modules' first step lives in the launcher and their second
  // does not: this swaps the whole sheet for the subject picker, which then
  // pushes the composer. See `QuickActionKind`'s `compose`.
  const composing =
    openAction?.kind === 'compose' ? openAction.tastingKind : undefined

  const choose = (action: QuickAction) => {
    if (action.kind === 'handoff') {
      onClose()
      router.push(action.href)
      return
    }

    setOpenId(action.id)
  }

  const actionText = (action: QuickAction) => text.actions[action.id]

  /** The form a `row` action expands into, under its row. */
  const capture = (action: QuickAction) => {
    switch (action.id) {
      case 'task-new':
        return (
          <QuickAddTask
            onSaved={(title, list) => {
              setAdded((items) => [...items, `${title} — ${list}`])
              setOpenId(null)
            }}
          />
        )
      default:
        return null
    }
  }

  const backButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={text.back}
      onPress={() => setOpenId(null)}
      hitSlop={12}
      style={({ pressed }) => [
        styles.close,
        { backgroundColor: tokens.tile },
        pressed && styles.pressed,
      ]}
    >
      <Back size={18} color={tokens.muted} />
    </Pressable>
  )

  if (composing) {
    return (
      <SubjectPickerSheet
        kind={composing}
        onClose={onClose}
        onChoose={(choice) => {
          onClose()
          router.push(
            moduleHref(`/all/tasting/${composing}/compose`, {
              mode: 'new',
              ...('subjectId' in choice
                ? { subjectId: choice.subjectId }
                : {
                    name: choice.name,
                    ...(choice.catalogKey
                      ? { catalogKey: choice.catalogKey }
                      : {}),
                  }),
            }),
          )
        }}
        leading={backButton}
      />
    )
  }

  return (
    <NativeSheet
      title={fmt(text.title, { group: groupName })}
      subtitle={
        added.length
          ? fmt(text.saved, { items: added.join(', ') })
          : text.workingOnly
      }
      onClose={onClose}
    >
      <ScrollView keyboardShouldPersistTaps="handled">
        <View style={styles.rows}>
          {QUICK_ACTIONS.map((action) => {
            const copy = actionText(action)
            const tint = tokens.tintOf(action.group)
            const Icon = MODULE_ICONS[action.icon]
            const expanded = action.kind === 'row' && openId === action.id

            return (
              <View key={action.id}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={copy.label}
                  onPress={() => choose(action)}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && styles.pressed,
                  ]}
                >
                  <View
                    style={[styles.rowIcon, { backgroundColor: tint.bg }]}
                  >
                    <Icon size={20} color={tint.fg} strokeWidth={1.8} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={[styles.rowLabel, { color: tokens.fg }]}>
                      {copy.label}
                    </Text>
                    <Text style={[styles.rowModule, { color: tokens.muted }]}>
                      {copy.module} · {text.kinds[action.kind]}
                    </Text>
                  </View>
                  {action.kind === 'handoff' || action.kind === 'compose' ? (
                    <Chevron size={18} color={tokens.muted} />
                  ) : null}
                </Pressable>
                {expanded ? capture(action) : null}
              </View>
            )
          })}
        </View>
      </ScrollView>
    </NativeSheet>
  )
}

const styles = StyleSheet.create({
  close: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rows: { gap: 2, paddingBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.tile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 1 },
  rowLabel: { fontSize: 16, fontWeight: '600' },
  rowModule: { fontSize: 13 },
  pressed: { opacity: 0.6 },
})
