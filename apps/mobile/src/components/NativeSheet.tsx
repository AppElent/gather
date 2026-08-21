import {
  BottomSheetModal,
  BottomSheetView,
} from '@expo/ui/community/bottom-sheet'
import { type ReactNode, useEffect, useRef } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'

import { useI18n } from '../i18n'
import { UI_ICONS } from '../theme/icons'
import { useTokens } from '../theme/tokens'
import { nativeSheetLayout } from './nativeSheetLayout'

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
}: NativeSheetProps) {
  const ref = useRef<BottomSheetModal>(null)
  const closed = useRef(false)
  const tokens = useTokens('home')
  const { t } = useI18n()
  const Close = UI_ICONS.X
  const layout = nativeSheetLayout(Platform.OS)

  useEffect(() => {
    ref.current?.present()
    return () => ref.current?.dismiss()
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
      backgroundStyle={{ backgroundColor: tokens.surface }}
    >
      <BottomSheetView
        style={[
          styles.content,
          fill && styles.fill,
          { paddingTop: layout.paddingTop },
        ]}
      >
        <View style={styles.heading}>
          {leading}
          <View style={styles.headingText}>
            <Text
              accessibilityRole="header"
              style={[styles.title, { color: tokens.fg }]}
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
            accessibilityLabel={t.actions.close}
            onPress={dismiss}
            hitSlop={12}
            style={({ pressed }) => [
              styles.close,
              { backgroundColor: tokens.tile },
              pressed && styles.pressed,
            ]}
          >
            <Close size={18} color={tokens.muted} strokeWidth={2.2} />
          </Pressable>
        </View>
        {children}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </BottomSheetView>
    </BottomSheetModal>
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
  title: { fontSize: 21, fontWeight: '700', letterSpacing: -0.4 },
  subtitle: { fontSize: 13 },
  footer: { paddingTop: 4 },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
})
