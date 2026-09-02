/**
 * The floating switcher every Labs screen carries.
 *
 * It is deliberately ugly against the design it sits on: a high-contrast pill
 * on the app's ink, not the Module's tint, so nobody spends a second wondering
 * whether it is part of what they are judging. It collapses to that pill,
 * because a permanent three-row panel would cover the bottom third of exactly
 * the composer this prototype exists to judge.
 *
 * `__DEV__` gates it as well as Labs itself. A prototype that leaked into a
 * production build would be a bug; a prototype that leaked *with its switcher*
 * would be an unexplainable one.
 */
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { haptics } from '../feedback/haptics'
import { useI18n } from '../i18n'
import { UI_ICONS } from '../theme/icons'
import { RADIUS, useTokens } from '../theme/tokens'
import type { VariantAxis } from './variants'

export interface VariantBarAxis {
  axis: VariantAxis<string>
  value: string
  onChange: (next: string) => void
}

export function VariantBar({ axes }: { axes: VariantBarAxis[] }) {
  const tokens = useTokens()
  const insets = useSafeAreaInsets()
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const Chevron = open ? UI_ICONS.ChevronDown : UI_ICONS.ChevronUp

  if (!__DEV__) return null

  const summary = axes.map(({ axis, value }) => `${axis.id}=${value}`).join(' ')

  return (
    <View
      pointerEvents="box-none"
      style={[styles.dock, { paddingBottom: insets.bottom + 8 }]}
    >
      {open ? (
        <View style={[styles.panel, { backgroundColor: tokens.fg }]}>
          {axes.map(({ axis, value, onChange }) => (
            <View key={axis.id} style={styles.axis}>
              <Text style={[styles.axisLabel, { color: tokens.bg }]}>
                {axis.label}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.options}
              >
                {axis.options.map((option) => {
                  const on = option.value === value
                  return (
                    <Pressable
                      key={option.value}
                      testID={`variant-${axis.id}-${option.value}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`${axis.label}: ${option.label}`}
                      onPress={() => {
                        if (!on) haptics.selectionChanged()
                        onChange(option.value)
                      }}
                      style={[
                        styles.option,
                        {
                          backgroundColor: on ? tokens.bg : 'transparent',
                          borderColor: tokens.bg,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionLabel,
                          { color: on ? tokens.fg : tokens.bg },
                        ]}
                      >
                        {option.label}
                      </Text>
                      {option.chosen ? (
                        <Text
                          accessibilityLabel={t.labs.variants.chosen}
                          style={[
                            styles.star,
                            { color: on ? tokens.fg : tokens.bg },
                          ]}
                        >
                          ★
                        </Text>
                      ) : null}
                    </Pressable>
                  )
                })}
              </ScrollView>
            </View>
          ))}
        </View>
      ) : null}

      <Pressable
        testID="variant-toggle"
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={open ? t.labs.variants.hide : t.labs.variants.show}
        onPress={() => {
          haptics.selectionChanged()
          setOpen(!open)
        }}
        style={({ pressed }) => [
          styles.pill,
          { backgroundColor: tokens.fg },
          pressed && styles.pressed,
        ]}
      >
        <Text
          numberOfLines={1}
          style={[styles.pillLabel, { color: tokens.bg }]}
        >
          {summary}
        </Text>
        <Chevron
          size={15}
          color={tokens.bg}
          strokeWidth={2.4}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 0,
    alignItems: 'flex-start',
    gap: 8,
  },
  panel: {
    alignSelf: 'stretch',
    borderRadius: RADIUS.card,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  axis: { gap: 5 },
  axisLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    opacity: 0.7,
    textTransform: 'uppercase',
  },
  options: { flexDirection: 'row', gap: 6, paddingRight: 4 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 32,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderRadius: 999,
  },
  optionLabel: { fontSize: 13, fontWeight: '600' },
  star: { fontSize: 10 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 34,
    paddingHorizontal: 13,
    borderRadius: 999,
  },
  pillLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
  pressed: { opacity: 0.75 },
})
