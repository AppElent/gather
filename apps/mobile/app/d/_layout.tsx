/**
 * PROTOTYPE (#146) — shape D: the web's `MobileDock`, honestly ported.
 *
 * Headless `expo-router/ui` tabs with a bar we draw ourselves, so the Pins can
 * come and go at runtime — #142 verified these key per screen, with no
 * navigator-level key to remount. The price is everything the platform stops
 * doing for you: the bar's height, its background, its inset, its type, its
 * press behaviour, and (on iOS) scroll-edge opacity and the minimise-on-scroll
 * behaviour, none of which exist here.
 *
 * `paddingBottom: insets.bottom` is *on* the bar rather than a `SafeAreaView`
 * around it, so the background bleeds into the gesture area while the contents
 * stay clear of the home indicator.
 */
import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui'
import type { ComponentProps } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { moduleById } from '../../proto/catalog'
import { FIXED_TABS, useProto } from '../../proto/state'
import { useTokens } from '../../proto/tokens'
import { Icon } from '../../proto/ui'

type ItemProps = ComponentProps<typeof Pressable> & {
  isFocused?: boolean
  label: string
  icon: string
}

function DockItem({ isFocused, label, icon, ...rest }: ItemProps) {
  const t = useTokens()
  const color = isFocused ? t.fg : t.muted
  return (
    <Pressable {...rest} style={styles.item}>
      <Icon name={icon} size={22} color={color} />
      <Text style={[styles.label, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  )
}

export default function VariantDLayout() {
  const t = useTokens()
  const insets = useSafeAreaInsets()
  const { pins } = useProto()

  // Only the three Modules this prototype gave routes to can appear in the
  // dock; a real build would route all thirteen. Unpinning one removes it from
  // the bar immediately, which is the whole claim shape D is here to test.
  const dockPins = pins.filter((id) => FIXED_TABS.includes(id))

  return (
    <Tabs>
      <TabSlot />
      <TabList
        style={[
          styles.bar,
          {
            backgroundColor: t.surface,
            borderTopColor: t.border,
            paddingBottom: insets.bottom + 8,
          },
        ]}
      >
        <TabTrigger name="home" href={'/d/home' as never} asChild>
          <DockItem label="Home" icon="home" />
        </TabTrigger>
        {dockPins.map((id) => {
          const module = moduleById(id)
          if (!module) return null
          return (
            <TabTrigger key={id} name={id} href={`/d/${id}` as never} asChild>
              <DockItem label={module.label} icon={module.icon} />
            </TabTrigger>
          )
        })}
        <TabTrigger name="all" href={'/d/all' as never} asChild>
          <DockItem label="All" icon="apps" />
        </TabTrigger>
      </TabList>
    </Tabs>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
  },
  item: { flex: 1, alignItems: 'center', gap: 3 },
  label: { fontSize: 10, fontWeight: '600' },
})
