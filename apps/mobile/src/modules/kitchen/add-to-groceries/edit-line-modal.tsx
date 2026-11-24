/**
 * In-app text edit dialog for an ingredient line on Android, where
 * `Alert.prompt` does not exist (APP-713).
 *
 * Registers with `openSheets` while mounted so an arriving Drop closes it
 * alongside the Add to groceries sheet and is never held back (APP-672).
 * `onShareClose` hides the modal without discarding the typed text, which the
 * parent sheet keeps in its `useSheetDraft` until reopened.
 */
import { useEffect, useRef } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { openSheet } from '../../../components/openSheets'
import { haptics } from '../../../feedback/haptics'
import { useI18n } from '../../../i18n'
import { RADIUS, SPACE, TYPE, useTokens } from '../../../theme/tokens'
import { Button } from '../../../ui/button'
import { Field } from '../../../ui/field'
import { Modal } from '../../../ui/modal'

export function EditLineModal({
  title,
  label,
  value,
  onChangeText,
  onSave,
  onClose,
  onShareClose,
}: {
  title: string
  label: string
  value: string
  onChangeText: (text: string) => void
  onSave: (value: string) => void
  onClose: () => void
  /** Called when an arriving Drop closes sheets, so the draft stays kept. */
  onShareClose: () => void
}) {
  const tokens = useTokens('kitchen')
  const { t } = useI18n()
  const valid = value.trim().length > 0

  const onShareCloseRef = useRef(onShareClose)
  onShareCloseRef.current = onShareClose
  useEffect(() => {
    const sheet = openSheet(() => onShareCloseRef.current())
    return sheet.closed
  }, [])

  const save = () => {
    const trimmed = value.trim()
    if (!trimmed) {
      haptics.actionFailed()
      return
    }
    haptics.itemSaved()
    onSave(trimmed)
  }

  return (
    <Modal
      transparent
      visible
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable
          testID="groceries-edit-scrim"
          accessibilityRole="button"
          accessibilityLabel={t.common.actions.cancel}
          onPress={onClose}
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor:
                tokens.scheme === 'dark'
                  ? 'rgba(0, 0, 0, 0.55)'
                  : 'rgba(26, 31, 29, 0.35)',
            },
          ]}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.center}
          pointerEvents="box-none"
        >
          <View
            testID="groceries-edit-dialog"
            style={[styles.card, { backgroundColor: tokens.surface }]}
          >
            <Text
              accessibilityRole="header"
              style={[styles.title, { color: tokens.ink }]}
            >
              {title}
            </Text>
            <Field
              testID="groceries-edit-field"
              label={label}
              value={value}
              onChangeText={onChangeText}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={save}
            />
            <View style={styles.actions}>
              <Button
                testID="groceries-edit-cancel"
                variant="ghost"
                label={t.common.actions.cancel}
                onPress={onClose}
              />
              <Button
                testID="groceries-edit-save"
                group="kitchen"
                label={t.common.actions.save}
                disabled={!valid}
                onPress={save}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACE[5],
  },
  card: {
    borderRadius: RADIUS.card,
    borderCurve: 'continuous',
    padding: SPACE[5],
    gap: SPACE[4],
  },
  title: { ...TYPE.title2, letterSpacing: -0.4 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: SPACE[2],
  },
})
