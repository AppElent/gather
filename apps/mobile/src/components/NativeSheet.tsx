import {
  BottomSheetModal,
  BottomSheetView,
} from '@expo/ui/community/bottom-sheet'
import { type ReactNode, useEffect, useRef } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'

import { useI18n } from '../i18n'
import { UI_ICONS } from '../theme/icons'
import { type ModuleGroup, RADIUS, TYPE, useTokens } from '../theme/tokens'

export interface NativeSheetProps {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  leading?: ReactNode
  maxHeight?: number
  /** A bounded scroll body needs to fill an explicit sheet detent. */
  fill?: boolean
  /**
   * The sheet's own colour. `surface` by default; `ground` for a sheet whose
   * content is itself `surface` cards and tiles (the quick-actions sheet).
   */
  background?: 'surface' | 'ground'
  /**
   * A form sheet's bar: Cancel on the left, the title centred, the confirming
   * action on the right in the Module's primary colour (the New list sheet).
   * Replaces the close button; Cancel dismisses exactly as it would.
   */
  confirm?: SheetConfirm
}

export interface SheetConfirm {
  label: string
  onPress: () => void
  disabled?: boolean
  busy?: boolean
  /** The Module whose primary button this is. */
  group?: ModuleGroup
  testID?: string
}

/**
 * Gather's small content convention around the platform sheet. The presentation,
 * scrim, drag gesture, detents, keyboard, and dismissal all belong to
 * `@expo/ui`'s native BottomSheetModal.
 */
export function NativeSheet({
  title,
  subtitle,
  onClose,
  children,
  footer,
  leading,
  maxHeight,
  fill = false,
  background = 'surface',
  confirm,
}: NativeSheetProps) {
  const ref = useRef<BottomSheetModal>(null)
  const closed = useRef(false)
  const tokens = useTokens()
  const { t } = useI18n()
  const Close = UI_ICONS.X

  useEffect(() => {
    const modal = ref.current
    modal?.present()
    return () => modal?.dismiss()
  }, [])

  const dismiss = () => ref.current?.dismiss()
  const handleDismiss = () => {
    if (closed.current) return
    closed.current = true
    onClose()
  }

  return (
    <BottomSheetModal
      ref={ref}
      enablePanDownToClose
      enableDynamicSizing={maxHeight === undefined}
      snapPoints={maxHeight ? [`${Math.round(maxHeight * 100)}%`] : undefined}
      onDismiss={handleDismiss}
      backgroundStyle={{ backgroundColor: tokens[background] }}
    >
      <BottomSheetView
        style={[
          styles.content,
          fill && styles.fill,
          { paddingTop: Platform.OS === 'ios' ? 8 : 0 },
        ]}
      >
        {confirm ? (
          <FormBar title={title} confirm={confirm} onCancel={dismiss} />
        ) : (
        <View style={styles.heading}>
          {leading}
          <View style={styles.headingText}>
            <Text
              accessibilityRole="header"
              style={[styles.title, { color: tokens.ink }]}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text style={[styles.subtitle, { color: tokens.muted }]}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.common.actions.close}
            onPress={dismiss}
            hitSlop={12}
            style={({ pressed }) => [
              styles.close,
              { backgroundColor: tokens.surface2 },
              pressed && styles.pressed,
            ]}
          >
            <Close size={18} color={tokens.muted} strokeWidth={2.2} />
          </Pressable>
        </View>
        )}
        {children}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </BottomSheetView>
    </BottomSheetModal>
  )
}

function FormBar({
  title,
  confirm,
  onCancel,
}: {
  title: string
  confirm: SheetConfirm
  onCancel: () => void
}) {
  const tokens = useTokens()
  const accent = useTokens(confirm.group)
  const { t } = useI18n()
  const inert = confirm.disabled || confirm.busy
  return (
    <View style={styles.bar}>
      <Pressable
        testID="sheet-cancel"
        accessibilityRole="button"
        accessibilityLabel={t.common.actions.cancel}
        onPress={onCancel}
        hitSlop={8}
        style={({ pressed }) => [
          styles.barButton,
          { backgroundColor: tokens.surface2 },
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.barLabel, { color: tokens.ink }]}>
          {t.common.actions.cancel}
        </Text>
      </Pressable>
      <Text
        accessibilityRole="header"
        numberOfLines={1}
        style={[styles.barTitle, { color: tokens.ink }]}
      >
        {title}
      </Text>
      <Pressable
        testID={confirm.testID}
        accessibilityRole="button"
        accessibilityLabel={confirm.label}
        accessibilityState={{ disabled: inert, busy: confirm.busy }}
        disabled={inert}
        onPress={confirm.onPress}
        hitSlop={8}
        style={({ pressed }) => [
          styles.barButton,
          { backgroundColor: accent.accent },
          inert && styles.disabled,
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.barConfirm, { color: accent.onAccent }]}>
          {confirm.label}
        </Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 20 },
  fill: { flex: 1 },
  heading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 14,
  },
  headingText: { flex: 1, gap: 2 },
  title: { ...TYPE.title2, letterSpacing: -0.4 },
  subtitle: { ...TYPE.footnote },
  footer: { paddingTop: 4 },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  barButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barTitle: { ...TYPE.bodyStrong, flex: 1, textAlign: 'center' },
  barLabel: { ...TYPE.body },
  barConfirm: { ...TYPE.bodyStrong },
})
