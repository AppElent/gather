/**
 * The auth gate's offline fallback (APP-143): the Loyalty cards saved on this
 * phone, for the till, while Gather cannot be reached.
 *
 * Display only. It reads the saved copy and nothing else: no Convex call, no
 * router, no Group. It offers no add, edit, delete or photo, and says it is
 * offline. When Convex authenticates, the gate replaces it with the normal
 * screens. It shows the store, its logo (bundled, found by `catalogKey`),
 * the holder and the barcode, and nothing more.
 */
import { Component, type ReactNode, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { fmt, useI18n } from '../../../i18n'
import { reportError } from '../../../observability/report'
import { UI_ICONS } from '../../../theme/icons'
import { RADIUS, TYPE, useTokens } from '../../../theme/tokens'
import { Button } from '../../../ui/button'
import { Card } from '../../../ui/card'
import { useHideSplash } from '../../../useHideSplash'
import { useKeepAwakeWhile } from '../card/use-keep-awake-while'
import { useTillBrightness } from '../card/use-till-brightness'
import { CardBarcode } from '../components/card-barcode'
import { StoreTile } from '../components/store-tile'
import type { OfflineCard } from './offline-cards'

export function OfflineLoyaltyCards({
  cards,
  onRetry,
  retrying,
}: {
  cards: OfflineCard[]
  onRetry: () => void
  retrying: boolean
}) {
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const onLayout = useHideSplash()
  const { t } = useI18n()
  const [openId, setOpenId] = useState<string | null>(null)
  const open = cards.find((card) => card._id === openId)

  return (
    <View
      testID="loyalty-card-offline"
      onLayout={onLayout}
      style={[styles.fill, { backgroundColor: tokens.ground }]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 },
        ]}
      >
        {open ? (
          <Pressable
            testID="loyalty-card-offline-back"
            accessibilityRole="button"
            onPress={() => setOpenId(null)}
            hitSlop={12}
            style={styles.back}
          >
            <UI_ICONS.ChevronLeft size={20} color={tokens.ink} />
            <Text style={[TYPE.body, { color: tokens.ink }]}>
              {t.loyaltyCards.offline.back}
            </Text>
          </Pressable>
        ) : (
          <Text
            accessibilityRole="header"
            style={[TYPE.title2, { color: tokens.ink }]}
          >
            {t.modules.byId['loyalty-cards'].label}
          </Text>
        )}

        <View
          style={[styles.notice, { backgroundColor: tokens.surface2 }]}
          accessibilityLiveRegion="polite"
        >
          <Text style={[TYPE.body, styles.noticeText, { color: tokens.ink }]}>
            {t.loyaltyCards.offline.notice}
          </Text>
          <Button
            label={t.gate.retry}
            variant="secondary"
            busy={retrying}
            disabled={retrying}
            onPress={onRetry}
            testID="loyalty-card-offline-retry"
          />
        </View>

        {open ? (
          <OfflineCardView card={open} />
        ) : (
          <Card>
            {cards.map((card, index) => (
              <Pressable
                key={card._id}
                testID={`loyalty-card-offline-${card._id}`}
                accessibilityRole="button"
                accessibilityLabel={[card.storeName, card.holder]
                  .filter(Boolean)
                  .join(', ')}
                onPress={() => setOpenId(card._id)}
                style={({ pressed }) => [
                  styles.row,
                  {
                    backgroundColor: pressed ? tokens.surface2 : tokens.surface,
                    borderBottomColor: tokens.hair,
                    borderBottomWidth:
                      index === cards.length - 1 ? 0 : StyleSheet.hairlineWidth,
                  },
                ]}
              >
                <StoreTile
                  name={card.storeName}
                  color={card.brandColor}
                  catalogKey={card.catalogKey}
                  size="medium"
                />
                <View style={styles.rowText}>
                  <Text
                    numberOfLines={1}
                    style={[TYPE.bodyStrong, { color: tokens.ink }]}
                  >
                    {card.storeName}
                  </Text>
                  {card.holder ? (
                    <Text
                      numberOfLines={1}
                      style={[TYPE.footnote, { color: tokens.muted }]}
                    >
                      {card.holder}
                    </Text>
                  ) : null}
                </View>
                <UI_ICONS.ChevronRight size={18} color={tokens.muted} />
              </Pressable>
            ))}
          </Card>
        )}
      </ScrollView>
    </View>
  )
}

function OfflineCardView({ card }: { card: OfflineCard }) {
  const tokens = useTokens('home')
  const { t } = useI18n()
  const words = t.loyaltyCards
  const formatName = words.formats[card.barcodeFormat]
  useKeepAwakeWhile(true)
  useTillBrightness(true)
  return (
    <View style={styles.card} testID="loyalty-card-offline-card">
      <View style={styles.store}>
        <StoreTile
          name={card.storeName}
          color={card.brandColor}
          catalogKey={card.catalogKey}
          size="large"
        />
        <View style={styles.rowText}>
          <Text
            accessibilityRole="header"
            style={[TYPE.title2, { color: tokens.ink }]}
          >
            {card.storeName}
          </Text>
          {card.holder ? (
            <Text style={[TYPE.subhead, { color: tokens.muted }]}>
              {card.holder}
            </Text>
          ) : null}
        </View>
      </View>
      <CardBarcode
        format={card.barcodeFormat}
        value={card.cardNumber}
        label={fmt(words.detail.barcodeLabel, {
          format: formatName,
          store: card.storeName,
        })}
      />
      <Text style={[TYPE.footnote, styles.hint, { color: tokens.muted }]}>
        {words.detail.showAtTill} · {formatName}
      </Text>
    </View>
  )
}

/**
 * A copy that draws badly is a missing copy: whatever throws in here shows
 * `fallback` (the gate's usual Unavailable screen) instead of an error screen.
 */
export class OfflineCopyBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error) {
    reportError(error)
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 16 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 },
  notice: { borderRadius: RADIUS.card, padding: 14, gap: 12 },
  noticeText: { textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 68,
    marginHorizontal: -14,
    paddingHorizontal: 14,
  },
  rowText: { flex: 1, gap: 2, paddingVertical: 10 },
  card: { gap: 16 },
  store: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  hint: { textAlign: 'center' },
})
