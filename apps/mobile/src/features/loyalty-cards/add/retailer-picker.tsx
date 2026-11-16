/**
 * Choose the store: from the Retailer catalog, or "Other store" by name
 * (APP-142).
 *
 * The whole Catalog comes down once (`searchCatalog` with an empty query
 * returns every store by name) and is filtered here with the rule Convex uses
 * (`searchRetailers`), so typing never waits on the network. When a scanned
 * number fits exactly one store's pattern, that store is offered first.
 */
import { searchRetailers } from '@gather/core/loyalty-cards'
import { useMemo, useState } from 'react'
import {
  AccessibilityInfo,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { LoadingSkeleton } from '../../../components/LoadingSkeleton'
import { SearchField } from '../../../components/SearchField'
import { fmt, useI18n } from '../../../i18n'
import { UI_ICONS } from '../../../theme/icons'
import { RADIUS, SIZE, TYPE, useTokens } from '../../../theme/tokens'
import { StoreTile } from '../components/store-tile'
import { LOYALTY_CARD_ICONS } from '../loyalty-card-icons'
import type { Retailer } from '../loyalty-card-types'

export function RetailerPicker({
  retailers,
  suggestion,
  scannedLine,
  onScanAgain,
  onPick,
  onOtherStore,
}: {
  /** The whole Catalog, or `undefined` while it loads. */
  retailers: readonly Retailer[] | undefined
  /** The one store a scanned number points at, if any. */
  suggestion: Retailer | null
  /** What was scanned, already in words, shown above the list. */
  scannedLine: string | null
  onScanAgain?: () => void
  onPick: (retailer: Retailer) => void
  onOtherStore: () => void
}) {
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const { t } = useI18n()
  const words = t.loyaltyCards
  const [query, setQuery] = useState('')

  const shown = useMemo(() => {
    if (!retailers) return []
    return searchRetailers(retailers, query)
  }, [retailers, query])

  function changeQuery(next: string) {
    setQuery(next)
    if (!retailers || !next.trim()) return
    const count = searchRetailers(retailers, next).length
    AccessibilityInfo.announceForAccessibility(
      count
        ? fmt(words.picker.matchCount, { count })
        : fmt(words.picker.noMatches, { query: next.trim() }),
    )
  }

  const header = (
    <View style={styles.header}>
      {scannedLine ? (
        <View style={styles.scanned}>
          <Text
            testID="loyalty-card-scanned"
            style={[TYPE.subhead, styles.scannedText, { color: tokens.muted }]}
          >
            {scannedLine}
          </Text>
          {onScanAgain ? (
            <Pressable
              accessibilityRole="button"
              testID="loyalty-card-scan-again"
              hitSlop={8}
              onPress={onScanAgain}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Text style={[TYPE.footnoteStrong, { color: tokens.ink }]}>
                {words.scan.scanAgain}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {suggestion ? (
        <View style={styles.suggestion}>
          <Text style={[TYPE.footnoteStrong, { color: tokens.muted }]}>
            {fmt(words.scan.suggestion, { store: suggestion.name })}
          </Text>
          <StoreRow
            retailer={suggestion}
            label={fmt(words.scan.useSuggestion, { store: suggestion.name })}
            testID="loyalty-card-suggestion"
            onPress={() => onPick(suggestion)}
          />
        </View>
      ) : null}
      <SearchField
        value={query}
        onChangeText={changeQuery}
        placeholder={words.picker.searchPlaceholder}
        clearAccessibilityLabel={t.search.clear}
        testID="loyalty-card-store-search"
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={words.picker.otherStore}
        accessibilityHint={words.picker.otherStoreHint}
        testID="loyalty-card-other-store"
        onPress={onOtherStore}
        style={({ pressed }) => [
          styles.row,
          { backgroundColor: tokens.surface, borderColor: tokens.hair },
          pressed && styles.pressed,
        ]}
      >
        <View style={[styles.otherIcon, { backgroundColor: tokens.surface2 }]}>
          <LOYALTY_CARD_ICONS.Store
            size={20}
            color={tokens.ink}
            strokeWidth={1.9}
          />
        </View>
        <View style={styles.rowText}>
          <Text style={[TYPE.bodyStrong, { color: tokens.ink }]}>
            {words.picker.otherStore}
          </Text>
          <Text style={[TYPE.footnote, { color: tokens.muted }]}>
            {words.picker.otherStoreHint}
          </Text>
        </View>
        <UI_ICONS.ChevronRight size={18} color={tokens.muted} />
      </Pressable>
      {retailers === undefined ? (
        <LoadingSkeleton rows={4} label={t.actions.loading} />
      ) : query.trim() && shown.length === 0 ? (
        <Text style={[TYPE.subhead, styles.empty, { color: tokens.muted }]}>
          {fmt(words.picker.noMatches, { query: query.trim() })}
        </Text>
      ) : null}
    </View>
  )

  return (
    <FlatList
      data={shown}
      keyExtractor={(retailer) => retailer.seedKey}
      ListHeaderComponent={header}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: tokens.ground }}
      contentContainerStyle={[
        styles.list,
        { paddingBottom: insets.bottom + 24 },
      ]}
      renderItem={({ item }) => (
        <StoreRow
          retailer={item}
          label={item.name}
          detail={words.categories[item.category]}
          testID={`loyalty-card-store-${item.seedKey}`}
          onPress={() => onPick(item)}
        />
      )}
    />
  )
}

function StoreRow({
  retailer,
  label,
  detail,
  testID,
  onPress,
}: {
  retailer: Retailer
  label: string
  detail?: string
  testID: string
  onPress: () => void
}) {
  const tokens = useTokens('home')
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: tokens.surface, borderColor: tokens.hair },
        pressed && styles.pressed,
      ]}
    >
      <StoreTile
        name={retailer.name}
        color={retailer.brandColor}
        catalogKey={retailer.seedKey}
        size="medium"
      />
      <View style={styles.rowText}>
        <Text style={[TYPE.bodyStrong, { color: tokens.ink }]}>
          {label}
        </Text>
        {detail ? (
          <Text style={[TYPE.footnote, { color: tokens.muted }]}>{detail}</Text>
        ) : null}
      </View>
      <UI_ICONS.ChevronRight size={18} color={tokens.muted} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  header: { gap: 12, marginBottom: 4 },
  suggestion: { gap: 6 },
  scanned: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  scannedText: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.card,
  },
  rowText: { flex: 1, gap: 2 },
  // The same tile as a store's StoreTile beside it.
  otherIcon: {
    width: SIZE.tileM,
    height: SIZE.tileM,
    borderRadius: RADIUS.tileM,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { textAlign: 'center', paddingVertical: 16 },
  pressed: { opacity: 0.7 },
})
