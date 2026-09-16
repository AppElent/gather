// Throwaway keyboard-anchored composer. Its native modal stays mounted while
// content expands upward; unlike the sheet experiment, no native host is replaced.
import type { ReactNode } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useI18n } from '../../../i18n'
import { useTokens } from '../../../theme/tokens'

export function PrototypeComposer({
  children,
  title,
  expanded,
  onClose,
  onSave,
  disabled,
}: {
  children: ReactNode
  title: string
  expanded: boolean
  onClose: () => void
  onSave: () => void
  disabled: boolean
}) {
  const tokens = useTokens('home')
  const { t } = useI18n()
  const insets = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  return (
    <Modal
      transparent
      visible
      animationType="fade"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={[styles.overlay, { paddingTop: insets.top + 8 }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable
          accessibilityLabel={t.actions.close}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.panel,
            {
              backgroundColor: tokens.surface,
              maxHeight: height - insets.top - 30,
              paddingBottom: Math.max(insets.bottom, 8),
            },
            expanded ? { height: height * 0.84 } : {},
          ]}
        >
          <View style={[styles.header, { borderBottomColor: tokens.border }]}>
            <Pressable
              testID="prototype-composer-close"
              accessibilityRole="button"
              onPress={onClose}
              style={styles.control}
            >
              <Text style={{ color: tokens.accent, fontSize: 16 }}>
                {t.tasksPrototype.close}
              </Text>
            </Pressable>
            <Text
              accessibilityRole="header"
              style={{
                color: tokens.fg,
                fontWeight: '600',
                fontSize: 16,
                flex: 1,
                textAlign: 'center',
              }}
            >
              {title}
            </Text>
            <Pressable
              testID="prototype-save"
              accessibilityRole="button"
              accessibilityLabel={t.tasksPrototype.save}
              disabled={disabled}
              onPress={onSave}
              style={[
                styles.control,
                styles.save,
                { backgroundColor: tokens.accent, opacity: disabled ? 0.4 : 1 },
              ]}
            >
              <Text
                style={{
                  color: tokens.onAccent,
                  fontWeight: '700',
                  fontSize: 17,
                }}
              >
                {t.tasksPrototype.save}
              </Text>
            </Pressable>
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0005' },
  panel: {
    marginHorizontal: 8,
    marginBottom: 8,
    borderRadius: 24,
    paddingHorizontal: 14,
    flexShrink: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  control: {
    minHeight: 44,
    minWidth: 62,
    justifyContent: 'center',
    alignItems: 'center',
  },
  save: { paddingHorizontal: 14, borderRadius: 22 },
})
