/**
 * PROTOTYPE (#146) — the shape switcher. Not part of any proposal: it is the
 * prototype's own chrome, so four shell shapes can be compared on one device
 * without a rebuild. Right edge, so it never sits on a tab bar or a header.
 */
import { router, usePathname } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { homeHref, useProto } from './state'
import type { GroupChrome, Variant } from './state'
import { useTokens } from './tokens'

/** What the second control shows: how visible the Group is off Home. */
const CHROME_LABEL: Record<GroupChrome, string> = {
  none: 'G0',
  content: 'G1',
  strip: 'G2',
}

const VARIANTS: { key: Variant; hint: string }[] = [
  { key: 'a', hint: 'native tabs: Home · All' },
  { key: 'b', hint: 'native tabs: Home · 3 fixed · All' },
  { key: 'd', hint: 'drawn dock from pins' },
  { key: 'f', hint: 'stack only, Home as hub' },
]

export function VariantBar() {
  const t = useTokens()
  const pathname = usePathname()
  const { groupChrome, cycleGroupChrome } = useProto()
  const current = (pathname.split('/')[1] ?? 'a') as Variant

  return (
    <View style={[styles.bar, { backgroundColor: t.fg, shadowColor: '#000' }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Group visibility off Home"
        onPress={cycleGroupChrome}
        style={[styles.item, { backgroundColor: t.bg }]}
      >
        <Text style={[styles.letter, { color: t.fg }]}>
          {CHROME_LABEL[groupChrome]}
        </Text>
      </Pressable>
      {VARIANTS.map(({ key }) => {
        const active = key === current
        return (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={`Shell shape ${key.toUpperCase()}`}
            onPress={() => router.replace(homeHref(key) as never)}
            style={[styles.item, active && { backgroundColor: t.bg }]}
          >
            <Text
              style={[styles.letter, { color: active ? t.fg : t.bg }]}
            >
              {key.toUpperCase()}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    right: 6,
    top: '38%',
    borderRadius: 999,
    padding: 3,
    gap: 2,
    opacity: 0.92,
    elevation: 6,
  },
  item: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: { fontSize: 11, fontWeight: '700' },
})
