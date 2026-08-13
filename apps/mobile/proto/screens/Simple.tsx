/** PROTOTYPE (#146) — a stand-in for a shell page the navigation has to reach. */
import { Stack } from 'expo-router'
import { ScrollView, StyleSheet, Text } from 'react-native'
import { useTokens } from '../tokens'

export function Simple({ title, body }: { title: string; body: string }) {
  const t = useTokens()
  return (
    <>
      <Stack.Screen options={{ title }} />
      <ScrollView
        style={{ backgroundColor: t.bg }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
      >
        <Text style={[styles.title, { color: t.fg }]}>{title}</Text>
        <Text style={[styles.body, { color: t.muted }]}>{body}</Text>
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 8 },
  title: { fontSize: 22, fontWeight: '700' },
  body: { fontSize: 14, lineHeight: 20 },
})
