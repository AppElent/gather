/**
 * "Don't have an account? Create one."
 *
 * A sentence with one tappable half, kept as one line of prose rather than a
 * second button — the two real actions on a form screen are the submit and the
 * way out of it, and a third button-shaped thing dilutes both.
 *
 * The touch target is the link half only, padded vertically to clear 44pt while
 * the prose stays inert. `accessibilityRole="link"` names it correctly to
 * TalkBack; the whole row would otherwise be read as one unlabelled control.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useTokens } from '../theme/tokens'

interface AuthLinkProps {
  /** The inert half. Omit for a bare link. */
  prompt?: string
  label: string
  onPress: () => void
}

export function AuthLink({ prompt, label, onPress }: AuthLinkProps) {
  const tokens = useTokens()

  return (
    <View style={styles.row}>
      {prompt ? (
        <Text style={[styles.prompt, { color: tokens.muted }]}>{prompt}</Text>
      ) : null}
      <Pressable
        onPress={onPress}
        accessibilityRole="link"
        accessibilityLabel={prompt ? `${prompt} ${label}` : label}
        hitSlop={8}
        style={({ pressed }) => [styles.hit, pressed && styles.pressed]}
      >
        <Text style={[styles.label, { color: tokens.fg }]}>{label}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  prompt: { fontSize: 14.5 },
  hit: { paddingVertical: 11 },
  pressed: { opacity: 0.6 },
  label: { fontSize: 14.5, fontWeight: '700', textDecorationLine: 'underline' },
})
