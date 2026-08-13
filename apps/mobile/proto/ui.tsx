/**
 * PROTOTYPE (#146) — throwaway. The handful of drawn pieces every screen needs.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useSegments } from 'expo-router'
import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { ProtoModule } from './catalog'
import type { Variant } from './state'
import { RADIUS, useTokens } from './tokens'

export function useVariant(): Variant {
  const segments = useSegments()
  const first = segments[0] as string | undefined
  return first === 'b' || first === 'd' || first === 'f' ? first : 'a'
}

export function Icon({
  name,
  size = 20,
  color,
}: {
  name: string
  size?: number
  color: string
}) {
  // `any`: MaterialIcons' name union is 2,000 strings and this is a prototype.
  return <MaterialIcons name={name as never} size={size} color={color} />
}

export function SectionTitle({ children }: { children: ReactNode }) {
  const t = useTokens()
  return (
    <Text style={[styles.sectionTitle, { color: t.muted }]}>{children}</Text>
  )
}

export function Card({ children }: { children: ReactNode }) {
  const t = useTokens()
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: t.surface, borderColor: t.border },
      ]}
    >
      {children}
    </View>
  )
}

/** A pinned Module, as it appears on Home: a tinted square with its name. */
export function PinTile({
  module,
  onPress,
}: {
  module: ProtoModule
  onPress: () => void
}) {
  const t = useTokens()
  const tint = t.tintOf(module.group)
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={module.label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pinTile,
        { backgroundColor: tint.bg, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Icon name={module.icon} size={22} color={tint.fg} />
      <Text numberOfLines={1} style={[styles.pinLabel, { color: t.fg }]}>
        {module.label}
      </Text>
    </Pressable>
  )
}

/** A Module in the catalogue, with its pin control. */
export function CatalogRow({
  module,
  pinned,
  onOpen,
  onTogglePin,
}: {
  module: ProtoModule
  pinned: boolean
  onOpen: () => void
  onTogglePin: () => void
}) {
  const t = useTokens()
  const tint = t.tintOf(module.group)
  return (
    <View style={[styles.catalogRow, { backgroundColor: tint.bg }]}>
      <Pressable
        accessibilityRole="button"
        onPress={onOpen}
        style={styles.catalogMain}
      >
        <View style={styles.catalogIcon}>
          <Icon name={module.icon} size={22} color={tint.fg} />
        </View>
        <View style={styles.catalogText}>
          <Text style={[styles.catalogLabel, { color: t.fg }]}>
            {module.label}
            {module.scope === 'personal' ? (
              <Text style={[styles.personal, { color: tint.fg }]}> · you</Text>
            ) : null}
          </Text>
          <Text numberOfLines={2} style={[styles.catalogDesc, { color: t.muted }]}>
            {module.description}
          </Text>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={pinned ? `Unpin ${module.label}` : `Pin ${module.label}`}
        onPress={onTogglePin}
        hitSlop={8}
        style={styles.pinButton}
      >
        <Icon
          name={pinned ? 'push-pin' : 'outlined-flag'}
          size={20}
          color={pinned ? tint.fg : t.muted}
        />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '700',
    marginTop: 18,
    marginBottom: 8,
  },
  card: {
    borderRadius: RADIUS.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  pinTile: {
    flex: 1,
    borderRadius: RADIUS.tile,
    padding: 11,
    gap: 8,
    minWidth: 0,
  },
  pinLabel: { fontSize: 12, fontWeight: '600' },
  catalogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.tile,
    marginBottom: 8,
  },
  catalogMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
  },
  catalogIcon: { width: 26, alignItems: 'center' },
  catalogText: { flex: 1, gap: 2 },
  catalogLabel: { fontSize: 14, fontWeight: '600' },
  personal: { fontSize: 12, fontWeight: '600' },
  catalogDesc: { fontSize: 11, lineHeight: 15 },
  pinButton: { padding: 14 },
})
