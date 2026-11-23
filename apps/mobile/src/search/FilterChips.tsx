/**
 * The filter chips at the top of the search results (APP-613): content under
 * the large title, scrolling with the results, never chrome around the native
 * search bar (`designs/search-filters/search_final.md`).
 *
 * 36 pt chips inside a 44 pt hit area. Selected is ink with inverse text,
 * unselected is surface with a hairline. Who, When and Status open the
 * system menu; the Module chip opens the Module sheet, and its ✕ sets All.
 */
import { MenuView } from '@expo/ui/community/menu'
import type { ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { fmt, useI18n } from '../i18n'
import { UI_ICONS } from '../theme/icons'
import { RADIUS, TYPE, useTokens } from '../theme/tokens'

const CHIP_HEIGHT = 36
/** Lifts a 36 pt chip to the 44 pt hit area. */
const CHIP_SLOP = { top: 4, bottom: 4, left: 0, right: 0 }

function ChipFace({
  label,
  selected,
  trailing,
}: {
  label: string
  selected: boolean
  trailing?: 'menu' | 'none'
}) {
  const tokens = useTokens()
  const ink = selected ? tokens.onInk : tokens.ink
  return (
    <View
      style={[
        styles.chip,
        selected
          ? { backgroundColor: tokens.ink, borderColor: tokens.ink }
          : { backgroundColor: tokens.surface, borderColor: tokens.hair },
      ]}
    >
      <Text numberOfLines={1} style={[styles.label, { color: ink }]}>
        {label}
      </Text>
      {trailing === 'menu' ? (
        <UI_ICONS.ChevronDown size={14} color={ink} strokeWidth={2.4} />
      ) : null}
    </View>
  )
}

export type MenuChoice = { id: string; title: string }

/** A chip whose values are a system menu: Who, When, Status. */
export function MenuChip({
  filter,
  value,
  choices,
  selectedId,
  onSelect,
  testID,
}: {
  /** The filter's name, shown while nothing is chosen. */
  filter: string
  /** What is chosen, or `null` for the filter's "any". */
  value: string | null
  /** The first choice is the "any" one. */
  choices: readonly MenuChoice[]
  selectedId: string
  onSelect: (id: string) => void
  testID: string
}) {
  const { t } = useI18n()
  const current =
    choices.find((choice) => choice.id === selectedId)?.title ?? ''
  return (
    <MenuView
      testID={testID}
      shouldOpenOnLongPress={false}
      actions={choices.map((choice) => ({
        id: choice.id,
        title: choice.title,
        state: choice.id === selectedId ? ('on' as const) : ('off' as const),
      }))}
      onPressAction={({ nativeEvent }) => onSelect(nativeEvent.event)}
    >
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={fmt(t.search.filters.chip, {
          filter,
          value: current,
        })}
        hitSlop={CHIP_SLOP}
        style={styles.hit}
      >
        <ChipFace
          label={value ?? filter}
          selected={value !== null}
          trailing="menu"
        />
      </View>
    </MenuView>
  )
}

/**
 * The Module chip. Unselected (All) it opens the sheet; selected it names the
 * Module, opens the sheet on its label and sets All on its ✕.
 */
export function ModuleChip({
  moduleLabel,
  onOpen,
  onClear,
}: {
  /** The chosen Module's name, or `null` for All. */
  moduleLabel: string | null
  onOpen: () => void
  onClear: () => void
}) {
  const tokens = useTokens()
  const { t } = useI18n()
  const words = t.search.filters
  const label = moduleLabel ?? words.allModules
  const selected = moduleLabel !== null
  const ink = selected ? tokens.onInk : tokens.ink
  return (
    <View
      style={[
        styles.chip,
        styles.moduleChip,
        selected
          ? { backgroundColor: tokens.ink, borderColor: tokens.ink }
          : { backgroundColor: tokens.surface, borderColor: tokens.hair },
      ]}
    >
      <Pressable
        testID="search-filter-module"
        accessibilityRole="button"
        accessibilityLabel={fmt(words.chip, {
          filter: words.module,
          value: label,
        })}
        hitSlop={{ top: 4, bottom: 4, left: 14, right: selected ? 0 : 14 }}
        onPress={onOpen}
        style={({ pressed }) => [styles.moduleOpen, pressed && styles.pressed]}
      >
        <Text numberOfLines={1} style={[styles.label, { color: ink }]}>
          {label}
        </Text>
        {selected ? null : (
          <UI_ICONS.ChevronDown size={14} color={ink} strokeWidth={2.4} />
        )}
      </Pressable>
      {selected ? (
        <Pressable
          testID="search-filter-module-clear"
          accessibilityRole="button"
          accessibilityLabel={words.clearModule}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 10 }}
          onPress={onClear}
          style={({ pressed }) => [
            styles.moduleClear,
            pressed && styles.pressed,
          ]}
        >
          <UI_ICONS.X size={14} color={ink} strokeWidth={2.6} />
        </Pressable>
      ) : null}
    </View>
  )
}

/** The row: a horizontal scroll so a long Dutch label never wraps a chip. */
export function FilterChipRow({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      accessibilityLabel={t.search.filters.label}
      // The row bleeds to the screen edge so a chip scrolls out under it, and
      // starts at the gutter like the cards below.
      style={styles.row}
      contentContainerStyle={styles.rowContent}
    >
      {children}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  row: { marginHorizontal: -16, flexGrow: 0 },
  rowContent: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  hit: { minHeight: 44, justifyContent: 'center' },
  chip: {
    minHeight: CHIP_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.pill,
  },
  moduleChip: { paddingHorizontal: 0, gap: 0 },
  moduleOpen: {
    minHeight: CHIP_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
  },
  moduleClear: {
    minHeight: CHIP_HEIGHT,
    justifyContent: 'center',
    paddingLeft: 2,
    paddingRight: 12,
    marginLeft: -6,
  },
  label: { ...TYPE.subhead, fontWeight: '600' },
  pressed: { opacity: 0.6 },
})
