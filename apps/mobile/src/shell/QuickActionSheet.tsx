import { router } from 'expo-router'
import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

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
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {visible ? <SheetBody groupName={groupName} onClose={onClose} /> : null}
    </Modal>
  )
}

function SheetBody({
  groupName,
  onClose,
}: {
  groupName: string
  onClose: () => void
}) {
  const tokens = useTokens()
  const insets = useSafeAreaInsets()
  const { t } = useI18n()
  const [openId, setOpenId] = useState<QuickActionId | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [added, setAdded] = useState<string[]>([])
  const text = t.shell.add
  const Close = UI_ICONS.X
  const Back = UI_ICONS.ChevronLeft
  const Chevron = UI_ICONS.ChevronRight
  const openAction = QUICK_ACTIONS.find((action) => action.id === openId)
  const inSheetCapture = openAction?.kind === 'sheet'

  const choose = (action: QuickAction) => {
    if (action.kind === 'handoff') {
      onClose()
      router.push({ pathname: '/create', params: { action: action.id } })
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
    <KeyboardAvoidingView
      style={styles.host}
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
    >
      <Pressable style={styles.scrim} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: tokens.surface,
            paddingBottom: insets.bottom + 16,
          },
        ]}
      >
        <View style={styles.grabber} />
        <View style={styles.head}>
          {inSheetCapture ? (
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
          ) : null}
          <View style={styles.headText}>
            <Text
              accessibilityRole="header"
              style={[styles.title, { color: tokens.fg }]}
            >
              {inSheetCapture && openAction
                ? actionText(openAction).label
                : fmt(text.title, { group: groupName })}
            </Text>
            <Text style={[styles.subtitle, { color: tokens.muted }]}>
              {added.length
                ? fmt(text.saved, { items: added.join(', ') })
                : text.workingOnly}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={text.close}
            onPress={onClose}
            hitSlop={12}
            style={({ pressed }) => [
              styles.close,
              { backgroundColor: tokens.tile },
              pressed && styles.pressed,
            ]}
          >
            <Close size={18} color={tokens.muted} />
          </Pressable>
        </View>

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
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  host: { flex: 1 },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 8,
    gap: 12,
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(128,128,128,0.45)',
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headText: { flex: 1, gap: 3 },
  title: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  subtitle: { fontSize: 13, lineHeight: 18 },
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
