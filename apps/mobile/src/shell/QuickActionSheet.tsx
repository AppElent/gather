/**
 * The add tab's launcher.
 *
 * It draws nothing of its own frame any more. Every sheet in the app is the
 * same `Sheet` — one drag gesture, one scrim, one answer to the keyboard — so a
 * fix to any of those is a fix to all four rather than to whichever copy
 * somebody happened to be looking at. This one only needs a Back button in the
 * heading, which is what `leading` is for.
 */
import { router } from 'expo-router'
import { useState } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { NativeSheet } from '../components/NativeSheet'
import { haptics } from '../feedback/haptics'
import { fmt, useI18n } from '../i18n'
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
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [added, setAdded] = useState<string[]>([])
  const text = t.shell.add
  const Back = UI_ICONS.ChevronLeft
  const Chevron = UI_ICONS.ChevronRight
  const openAction = QUICK_ACTIONS.find((action) => action.id === openId)
  const inSheetCapture = openAction?.kind === 'sheet'

  const choose = (action: QuickAction) => {
    if (action.kind === 'handoff') {
      onClose()
      // The Module's own screen where there is one; the shared demo form
      // where there is not. The launcher does not know which Module it is
      // handing to, and must not start to.
      router.push(
        action.href ?? { pathname: '/create', params: { action: action.id } },
      )
      return
    }

    setDraft({})
    setOpenId(action.id)
  }

  const actionText = (action: QuickAction) => text.actions[action.id]

  const save = (action: QuickAction) => {
    const fields = actionText(action).fields
    const first = draft[fields[0]]?.trim()
    if (!first) {
      haptics.actionFailed()
      return
    }

    haptics.itemSaved()
    setAdded((items) => [...items, `${first} — ${actionText(action).noun}`])
    setDraft({})
    setOpenId(null)
  }

  const capture = (action: QuickAction) => {
    const copy = actionText(action)
    const ready = Boolean(draft[copy.fields[0]]?.trim())

    return (
      <View style={styles.capture}>
        {copy.fields.map((field, index) => (
          <TextInput
            key={field}
            autoFocus={index === 0}
            value={draft[field] ?? ''}
            onChangeText={(value) =>
              setDraft((current) => ({ ...current, [field]: value }))
            }
            placeholder={field}
            placeholderTextColor={tokens.muted}
            returnKeyType={index === copy.fields.length - 1 ? 'done' : 'next'}
            onSubmitEditing={() => {
              if (index === copy.fields.length - 1) save(action)
            }}
            style={[
              styles.input,
              {
                color: tokens.fg,
                backgroundColor: tokens.bg,
                borderColor: tokens.border,
              },
            ]}
          />
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={fmt(text.save, { noun: copy.noun })}
          onPress={() => save(action)}
          disabled={!ready}
          style={({ pressed }) => [
            styles.saveButton,
            { backgroundColor: ready ? tokens.fg : tokens.tile },
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[
              styles.saveLabel,
              { color: ready ? tokens.bg : tokens.muted },
            ]}
          >
            {fmt(text.save, { noun: copy.noun })}
          </Text>
        </Pressable>
      </View>
    )
  }

  return (
    <NativeSheet
      title={
        inSheetCapture && openAction
          ? actionText(openAction).label
          : fmt(text.title, { group: groupName })
      }
      subtitle={
        added.length
          ? fmt(text.saved, { items: added.join(', ') })
          : text.workingOnly
      }
      onClose={onClose}
      leading={
        inSheetCapture ? (
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
        ) : null
      }
    >
      <ScrollView keyboardShouldPersistTaps="handled">
        {inSheetCapture && openAction ? (
          <View style={styles.sheetCapture}>
            {capture(openAction)}
            <Text style={[styles.hint, { color: tokens.muted }]}>
              {fmt(text.sheetHint, { group: groupName })}
            </Text>
          </View>
        ) : (
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
                    {action.kind === 'handoff' ? (
                      <Chevron size={18} color={tokens.muted} />
                    ) : null}
                  </Pressable>
                  {expanded ? capture(action) : null}
                </View>
              )
            })}
          </View>
        )}
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
  sheetCapture: { gap: 10, paddingBottom: 8 },
  capture: { gap: 8, paddingBottom: 8 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.control,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 16,
  },
  saveButton: {
    borderRadius: RADIUS.control,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveLabel: { fontSize: 15, fontWeight: '700' },
  hint: { fontSize: 13, lineHeight: 19 },
  pressed: { opacity: 0.6 },
})
