/**
 * PROTOTYPE — throwaway. See `src/prototype/tabLayout/README.md`.
 *
 * The stand-in for a Module's full create form, and the thing "hand off" hands
 * off *to*. It is a stub — nothing it collects is saved — but it is in the
 * right place, which is the point: a create form is not one of the five
 * destinations, so it lives above the tabs in the root stack, gets the
 * platform's push and back, and **takes the tab bar away while it is open**.
 *
 * That is what makes the hand-off behaviour worth feeling rather than
 * discussing. Open it from the middle of Search, or halfway down Home, and
 * notice what it costs to get back: the bar is gone, the screen is full, and a
 * five-second capture has become a place you have to leave.
 *
 * The fields are deliberately more than the action needs. A real create form
 * is; that is why it cannot live in a sheet, and why `capture: 'text'` actions
 * should not be sent here at all.
 */
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { QUICK_ACTIONS } from '../../src/prototype/tabLayout/actions'
import { RADIUS, useTokens } from '../../src/theme/tokens'

/** More fields than any one action needs — a real editor has them. */
const FIELDS = ['Name', 'Notes', 'Tags'] as const

export default function ProtoCreate() {
  const tokens = useTokens()
  const insets = useSafeAreaInsets()
  const { action: actionId } = useLocalSearchParams<{ action?: string }>()
  const [saved, setSaved] = useState(false)

  const action = QUICK_ACTIONS.find((item) => item.id === actionId)
  const title = action ? action.label : 'Create'

  return (
    <>
      <Stack.Screen
        options={{ headerShown: true, title: action?.module ?? 'Create' }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
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
            {title}
          </Text>
          <Text style={[styles.note, { color: tokens.muted }]}>
            A stand-in for the real create form this Module would own. Notice
            the tab bar is gone, and that getting back to what you were doing is
            now your job.
          </Text>

          {FIELDS.map((field) => (
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
            onPress={() => setSaved(true)}
            style={({ pressed }) => [
              styles.save,
              { backgroundColor: tokens.fg },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.saveLabel, { color: tokens.bg }]}>Save</Text>
          </Pressable>

          {saved ? (
            <Text style={[styles.note, { color: tokens.muted }]}>
              Nothing was saved — this is a stub. Now find your way back.
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
          >
            <Text style={[styles.cancelLabel, { color: tokens.muted }]}>
              Cancel
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
