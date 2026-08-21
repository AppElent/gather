import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useI18n } from '../../src/i18n'
import { QUICK_ACTIONS } from '../../src/shell/quickActions'
import { RADIUS, useTokens } from '../../src/theme/tokens'

/** Temporary stand-in for full Module-owned create forms. It intentionally saves nothing. */
export default function Create() {
  const tokens = useTokens()
  const insets = useSafeAreaInsets()
  const { t } = useI18n()
  const { action: actionId } = useLocalSearchParams<{ action?: string }>()
  const [saved, setSaved] = useState(false)
  const action = QUICK_ACTIONS.find((item) => item.id === actionId)
  const copy = action ? t.shell.add.actions[action.id] : null

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: copy?.module ?? t.shell.add.create.title,
        }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          style={{ backgroundColor: tokens.bg }}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: tokens.fg }]}
          >
            {copy?.label ?? t.shell.add.create.title}
          </Text>
          <Text style={[styles.note, { color: tokens.muted }]}>
            {t.shell.add.create.description}
          </Text>
          {t.shell.add.create.fields.map((field) => (
            <View key={field} style={styles.field}>
              <Text style={[styles.label, { color: tokens.muted }]}>
                {field}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: tokens.fg,
                    backgroundColor: tokens.surface,
                    borderColor: tokens.border,
                  },
                ]}
                placeholder={field}
                placeholderTextColor={tokens.muted}
              />
            </View>
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.shell.add.create.save}
            onPress={() => setSaved(true)}
            style={({ pressed }) => [
              styles.save,
              { backgroundColor: tokens.fg },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.saveLabel, { color: tokens.bg }]}>
              {t.shell.add.create.save}
            </Text>
          </Pressable>
          {saved ? (
            <Text style={[styles.note, { color: tokens.muted }]}>
              {t.shell.add.create.saved}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.actions.back}
            onPress={() => router.back()}
            style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
          >
            <Text style={[styles.cancelLabel, { color: tokens.muted }]}>
              {t.actions.back}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 16, gap: 14 },
  title: { fontSize: 24, fontWeight: '700', letterSpacing: -0.4 },
  note: { fontSize: 13, lineHeight: 19 },
  field: { gap: 5 },
  label: { fontSize: 13, fontWeight: '600' },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.control,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 16,
  },
  save: {
    borderRadius: RADIUS.control,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  saveLabel: { fontSize: 16, fontWeight: '700' },
  cancel: { paddingVertical: 12, alignItems: 'center' },
  cancelLabel: { fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.75 },
})
