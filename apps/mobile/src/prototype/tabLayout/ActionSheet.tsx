/**
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * Add as a **verb**: a sheet over wherever you already were. Round two asked
 * what happens when you pick a row, and the answer settled is that the shell
 * does not decide — **each action carries its own kind** (`actions.ts`), and
 * this file obeys it:
 *
 * - **`row`** — the row you tapped grows a field in place. The other actions
 *   stay on screen, the sheet never changes shape, and saving leaves the
 *   launcher open so you can add another immediately.
 * - **`sheet`** — the body swaps to that action's two or three fields with a
 *   back chevron. Room to collect more than a title, and somewhere to report an
 *   outcome, without becoming a screen.
 * - **`handoff`** — the launcher closes and pushes the Module's create form
 *   (`/proto-create`). For the ones that genuinely cannot finish here.
 *
 * A mixed sheet is the thing to judge now: three kinds of row sitting in one
 * list. Each is tagged with what it will do, so the mix should read as a range
 * of speeds rather than as inconsistency — if it does not, the tags are the
 * first thing to change, not the kinds.
 *
 * `kindOverride.ts` can force every action to one kind. That is a measuring
 * instrument for choosing each action's `kind`, not part of the design.
 *
 * A plain `Modal` rather than a `formSheet` route, because the variants using
 * this are arguing that Add is *not* a destination, and giving it an address
 * would concede the point being tested.
 *
 * Nothing writes. "Added" is in-memory and dies with the sheet.
 */
import { router } from 'expo-router'
import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { MODULE_ICONS, UI_ICONS } from '../../theme/icons'
import { RADIUS, useTokens } from '../../theme/tokens'
import { KIND_LABELS, QUICK_ACTIONS, type QuickAction } from './actions'
import { PROTO_ICONS } from './icons'
import { effectiveKind, useOverride } from './kindOverride'

/** Only used when an override forces a capture onto a handoff-only action. */
const FALLBACK_FIELDS = ['Name'] as const

export function ActionSheet({
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
      {/* Mounted only while open, so a fresh open is a fresh launcher — last
          time's half-typed task dies with the unmount. `Modal` keeps its
          children alive when `visible` is false, so resetting the state would
          otherwise need an effect, and setting state in an effect is the
          cascading-render trap Biome's rule exists to catch. */}
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
  const override = useOverride()
  const [openId, setOpenId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [added, setAdded] = useState<string[]>([])
  const Close = PROTO_ICONS.X
  const Back = UI_ICONS.ChevronLeft
  const Chevron = UI_ICONS.ChevronRight

  const kindOf = (action: QuickAction) => effectiveKind(action.kind, override)
  const fieldsOf = (action: QuickAction) => action.fields ?? FALLBACK_FIELDS

  const choose = (action: QuickAction) => {
    if (kindOf(action) === 'handoff') {
      onClose()
      router.push({ pathname: '/proto-create', params: { action: action.id } })
      return
    }
    setDraft({})
    setOpenId(action.id)
  }

  const save = (action: QuickAction) => {
    const first = draft[fieldsOf(action)[0]]?.trim()
    if (!first) return
    setAdded((previous) => [...previous, `${first} — ${action.noun ?? 'item'}`])
    setDraft({})
    setOpenId(null)
  }

  const openAction = QUICK_ACTIONS.find((item) => item.id === openId)
  const inSheetCapture = openAction && kindOf(openAction) === 'sheet'

  const capture = (action: QuickAction) => {
    const fields = fieldsOf(action)
    const ready = Boolean(draft[fields[0]]?.trim())

    return (
      <View style={styles.capture}>
        {fields.map((placeholder, index) => (
          <TextInput
            key={placeholder}
            autoFocus={index === 0}
            value={draft[placeholder] ?? ''}
            onChangeText={(text) =>
              setDraft((previous) => ({ ...previous, [placeholder]: text }))
            }
            placeholder={placeholder}
            placeholderTextColor={tokens.muted}
            returnKeyType={index === fields.length - 1 ? 'done' : 'next'}
            onSubmitEditing={() => {
              if (index === fields.length - 1) save(action)
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
          accessibilityLabel={`Save ${action.noun ?? 'item'}`}
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
            Save
          </Text>
        </Pressable>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.host}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
              accessibilityLabel="Back to actions"
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
                ? openAction.label
                : `Add to ${groupName}`}
            </Text>
            <Text style={[styles.subtitle, { color: tokens.muted }]}>
              {added.length
                ? `Added: ${added.join(', ')}`
                : 'Only actions that work today.'}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
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

        {/* A `sheet` capture takes the body over; a `row` one grows inside the
            list and leaves every other action reachable. That difference is
            the whole reason both kinds exist. */}
        {inSheetCapture && openAction ? (
          <View style={styles.sheetCapture}>
            {capture(openAction)}
            <Text style={[styles.hint, { color: tokens.muted }]}>
              Saving keeps you here, in {groupName}. The back arrow returns to
              the other actions.
            </Text>
          </View>
        ) : (
          <View style={styles.rows}>
            {QUICK_ACTIONS.map((action) => {
              const tint = tokens.tintOf(action.group)
              const Icon = MODULE_ICONS[action.icon]
              const kind = kindOf(action)
              const expanded = kind === 'row' && openId === action.id

              return (
                <View key={action.id}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={action.label}
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
                        {action.label}
                      </Text>
                      {/* The kind, in words, so the mix is legible before you
                          tap rather than only after. */}
                      <Text style={[styles.rowModule, { color: tokens.muted }]}>
                        {action.module} · {KIND_LABELS[kind]}
                      </Text>
                    </View>
                    {kind === 'handoff' ? (
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
