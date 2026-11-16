/**
 * One Loyalty card, as shown at the till (APP-142).
 *
 * The barcode leads, as large as the screen allows, on a white panel in light
 * and dark mode alike, with the number under it for a cashier to type. While
 * the card is on screen it is at full brightness (`useTillBrightness`) and
 * stays awake (`useKeepAwakeWhile`). Both follow focus, not mount: switching
 * tab or opening Edit keeps this screen mounted, and gives both back.
 * Opening it counts as using it, once (`useMarkUsedOnce`), except the open
 * that follows adding the card (`justAdded`).
 */
import { Image } from 'expo-image'
import { Stack, useIsFocused, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { LoadingSkeleton } from '../../../components/LoadingSkeleton'
import { api, type Id } from '../../../convex/api'
import { useQuery } from '../../../convex/queries'
import { useGroup } from '../../../group/GroupProvider'
import { fmt, useI18n } from '../../../i18n'
import { moduleHref } from '../../../modules/moduleDestination'
import { UI_ICONS } from '../../../theme/icons'
import { RADIUS, TYPE, useTokens } from '../../../theme/tokens'
import { CardBarcode } from '../components/card-barcode'
import { HeaderIconButton } from '../components/header-icon-button'
import { StoreTile } from '../components/store-tile'
import { LOYALTY_CARD_ICONS } from '../loyalty-card-icons'
import { useDeleteLoyaltyCard } from '../use-delete-loyalty-card'
import { useKeepAwakeWhile } from './use-keep-awake-while'
import { useMarkUsedOnce } from './use-mark-used-once'
import { useTillBrightness } from './use-till-brightness'

export function LoyaltyCardViewScreen({
  cardId,
  justAdded = false,
}: {
  cardId: Id<'loyaltyCards'>
  justAdded?: boolean
}) {
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { t } = useI18n()
  const { group } = useGroup()
  const words = t.loyaltyCards
  const card = useQuery(api.loyaltyCards.get, {
    groupSlug: group.slug,
    id: cardId,
  })
  const deleteCard = useDeleteLoyaltyCard(group.slug)
  const [problem, setProblem] = useState<string | null>(null)

  const shown = useIsFocused() && Boolean(card)
  useKeepAwakeWhile(shown)
  useTillBrightness(shown)
  useMarkUsedOnce(group.slug, cardId, justAdded)

  const moduleTitle = t.modules.byId['loyalty-cards'].label

  if (card === undefined) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: moduleTitle }} />
        <View style={[styles.fill, { backgroundColor: tokens.bg }]}>
          <LoadingSkeleton rows={3} label={t.actions.loading} />
        </View>
      </>
    )
  }

  if (card === null) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: moduleTitle }} />
        <View style={[styles.fill, { backgroundColor: tokens.bg }]}>
          <Text
            testID="loyalty-card-not-found"
            style={[TYPE.lead, styles.missing, { color: tokens.muted }]}
          >
            {words.detail.notFound}
          </Text>
        </View>
      </>
    )
  }

  const store = card.storeName
  const formatName = words.formats[card.barcodeFormat]

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: store,
          headerRight: () => (
            <View style={styles.headerActions}>
              <HeaderIconButton
                label={words.till.edit}
                testID="loyalty-card-edit"
                onPress={() =>
                  router.push(
                    moduleHref('/all/loyalty-cards/edit', { cardId: card._id }),
                  )
                }
              >
                <UI_ICONS.Pencil size={19} color={tokens.fg} strokeWidth={1.9} />
              </HeaderIconButton>
              <HeaderIconButton
                label={words.till.delete}
                testID="loyalty-card-delete"
                onPress={() =>
                  deleteCard(card, {
                    onDeleted: () => router.back(),
                    onFailed: setProblem,
                  })
                }
              >
                <LOYALTY_CARD_ICONS.Trash2
                  size={19}
                  color={tokens.danger}
                  strokeWidth={1.9}
                />
              </HeaderIconButton>
            </View>
          ),
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: tokens.bg }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 32 },
        ]}
      >
        <View style={styles.store}>
          <StoreTile
            name={store}
            color={card.brandColor}
            catalogKey={card.catalogKey}
            size="large"
          />
          <View style={styles.storeText}>
            <Text
              accessibilityRole="header"
              style={[TYPE.title, styles.storeName, { color: tokens.fg }]}
            >
              {store}
            </Text>
            {card.holder ? (
              <Text style={[TYPE.body, { color: tokens.muted }]}>
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
            store,
          })}
        />
        <Text style={[TYPE.label, styles.hint, { color: tokens.muted }]}>
          {words.detail.showAtTill} · {formatName}
        </Text>

        {problem ? (
          <Text
            accessibilityRole="alert"
            style={[TYPE.body, { color: tokens.danger }]}
          >
            {problem}
          </Text>
        ) : null}

        {card.note ? (
          <View style={styles.section}>
            <Text style={[TYPE.label, styles.label, { color: tokens.muted }]}>
              {words.detail.note.toUpperCase()}
            </Text>
            <Text selectable style={[TYPE.body, { color: tokens.fg }]}>
              {card.note}
            </Text>
          </View>
        ) : null}

        {card.frontPhotoUrl || card.backPhotoUrl ? (
          <View style={styles.section}>
            <Text style={[TYPE.label, styles.label, { color: tokens.muted }]}>
              {words.detail.photos.toUpperCase()}
            </Text>
            <View style={styles.photos}>
              {card.frontPhotoUrl ? (
                <Image
                  source={{ uri: card.frontPhotoUrl }}
                  style={[styles.photo, { backgroundColor: tokens.tile }]}
                  contentFit="cover"
                  accessibilityLabel={fmt(words.till.front, { store })}
                  accessibilityIgnoresInvertColors
                />
              ) : null}
              {card.backPhotoUrl ? (
                <Image
                  source={{ uri: card.backPhotoUrl }}
                  style={[styles.photo, { backgroundColor: tokens.tile }]}
                  contentFit="cover"
                  accessibilityLabel={fmt(words.till.back, { store })}
                  accessibilityIgnoresInvertColors
                />
              ) : null}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  missing: { textAlign: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  headerActions: { flexDirection: 'row', gap: 4 },
  content: { paddingHorizontal: 16, paddingTop: 12, gap: 16 },
  store: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  storeText: { flex: 1, gap: 2 },
  storeName: { fontWeight: '700' },
  hint: { textAlign: 'center' },
  section: { gap: 8 },
  label: { fontWeight: '700', letterSpacing: 0.8 },
  photos: { flexDirection: 'row', gap: 10 },
  photo: { flex: 1, aspectRatio: 1.586, borderRadius: RADIUS.card },
})
