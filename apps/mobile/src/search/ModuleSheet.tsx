/**
 * "Search in": the sheet the Module chip opens (APP-613, `S613-3-Kiezen`).
 * All Modules first, then every searchable Module this build shows; the
 * current one is checked. Choosing closes the sheet, and the query stays.
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { NativeSheet } from '../components/NativeSheet'
import { useI18n } from '../i18n'
import { UI_ICONS } from '../theme/icons'
import { RADIUS, TYPE, useTokens } from '../theme/tokens'
import { radioProps } from '../ui/radio-props'
import type { SearchModuleId } from './searchFilters'

export function ModuleSheet({
  modules,
  selected,
  onSelect,
  onClose,
}: {
  modules: readonly SearchModuleId[]
  selected: SearchModuleId | null
  onSelect: (module: SearchModuleId | null) => void
  onClose: () => void
}) {
  const tokens = useTokens()
  const { t } = useI18n()
  const Check = UI_ICONS.Check
  const choices: { id: SearchModuleId | null; label: string }[] = [
    { id: null, label: t.search.filters.allModules },
    ...modules.map((id) => ({ id, label: t.modules.byId[id].label })),
  ]

  return (
    <NativeSheet
      title={t.search.filters.sheetTitle}
      onClose={onClose}
      background="ground"
      maxHeight={0.7}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View
          style={[
            styles.card,
            { backgroundColor: tokens.surface, borderColor: tokens.hair },
          ]}
        >
          {choices.map((choice, index) => {
            const current = choice.id === selected
            return (
              <Pressable
                key={choice.id ?? 'all'}
                testID={`search-module-${choice.id ?? 'all'}`}
                {...radioProps(current, t.a11y.radioButton)}
                onPress={() => {
                  onSelect(choice.id)
                  onClose()
                }}
                android_ripple={{ color: tokens.surface2 }}
                style={({ pressed }) => [
                  styles.row,
                  pressed && { backgroundColor: tokens.surface2 },
                ]}
              >
                {index > 0 ? (
                  <View
                    style={[styles.separator, { backgroundColor: tokens.hair }]}
                  />
                ) : null}
                <Text style={[styles.label, { color: tokens.ink }]}>
                  {choice.label}
                </Text>
                {current ? (
                  <Check size={20} color={tokens.ink} strokeWidth={2.4} />
                ) : null}
              </Pressable>
            )
          })}
        </View>
      </ScrollView>
    </NativeSheet>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: 8 },
  card: {
    borderRadius: RADIUS.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
  },
  label: { ...TYPE.body, flex: 1 },
  // Laid over the row's top edge, inset to the label's column, and half a
  // point rather than a hairline: a one-pixel line in this sheet snaps away
  // at some offsets on a 3x screen.
  separator: {
    position: 'absolute',
    top: 0,
    left: 14,
    right: 0,
    height: Math.max(StyleSheet.hairlineWidth, 0.5),
  },
})
