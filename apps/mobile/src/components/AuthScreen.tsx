/**
 * The shape every pushed auth screen has: a heading, a line of explanation, the
 * fields, the error, the actions.
 *
 * The heading lives in the body rather than in the native header — the Stack's
 * header is left as a bare back chevron. Two reasons: a 28pt heading in the body
 * survives being read at arm's length in a way a 17pt header title does not, and
 * a header title plus an in-body heading is the same words twice.
 *
 * `keyboardShouldPersistTaps="handled"` is not optional here. Without it, the
 * first tap on Sign in while the password field has focus is swallowed by the
 * keyboard dismissal, and the button appears to need pressing twice.
 */
import type { ReactNode } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { useTokens } from '../theme/tokens'

interface AuthScreenProps {
  heading: string
  subtitle?: string
  children: ReactNode
  /** Sits below the actions, against the bottom of the scroll content. */
  footer?: ReactNode
}

export function AuthScreen({
  heading,
  subtitle,
  children,
  footer,
}: AuthScreenProps) {
  const tokens = useTokens()

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: tokens.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.head}>
          <Text
            accessibilityRole="header"
            style={[styles.heading, { color: tokens.fg }]}
          >
            {heading}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: tokens.muted }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        <View style={styles.body}>{children}</View>

        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40, gap: 26 },
  head: { gap: 8 },
  heading: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  body: { gap: 18 },
  footer: { alignItems: 'center' },
})
