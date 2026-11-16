/**
 * The household's Loyalty cards, last used first (APP-142).
 *
 * The order is Convex's (`compareLoyaltyCards`), so the card shown at the till
 * last week is the one at the top now. A tap opens the card for the till;
 * holding a row offers Edit and Delete. The filter matches the store and whose
 * card it is, the way the web's does.
 */
import { foldForSearch } from '@gather/core/loyalty-cards'
import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { LoadingSkeleton } from '../../../components/LoadingSkeleton'
import { NativeContextMenu } from '../../../components/NativeContextMenu'
import { SearchField } from '../../../components/SearchField'
import { api } from '../../../convex/api'
import { useQuery } from '../../../convex/queries'
import { useGroup } from '../../../group/GroupProvider'
import { fmt, useI18n } from '../../../i18n'
import { moduleHref } from '../../../modules/moduleDestination'
import { UI_ICONS } from '../../../theme/icons'
import { TYPE, useTokens } from '../../../theme/tokens'
import { Button } from '../../../ui/button'
import { Card } from '../../../ui/card'
import { HeaderIconButton } from '../components/header-icon-button'
import { StoreTile } from '../components/store-tile'
import type { ListedCard } from '../loyalty-card-types'
import { useDeleteLoyaltyCard } from '../use-delete-loyalty-card'
import { cardLastUsed } from './card-last-used'

export function LoyaltyCardListScreen() {
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { t, locale } = useI18n()
  const { group } = useGroup()
  const words = t.loyaltyCards
  const cards = useQuery(api.loyaltyCards.list, { groupSlug: group.slug })
  const deleteCard = useDeleteLoyaltyCard(group.slug)
  const [query, setQuery] = useState('')
  const [problem, setProblem] = useState<string | null>(null)

  const needle = foldForSearch(query.trim())
  const matching = (cards ?? []).filter(
    (card) =>
      !needle ||
      foldForSearch(card.storeName).includes(needle) ||
      foldForSearch(card.holder ?? '').includes(needle),
  )

  const add = () => router.push(moduleHref('/all/loyalty-cards/new'))
  const open = (card: ListedCard) =>
    router.push(moduleHref('/all/loyalty-cards/card', { cardId: card._id }))

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: t.modules.byId['loyalty-cards'].label,
          headerRight: () => (
            <HeaderIconButton
              label={words.index.add}
              testID="loyalty-card-add"
              onPress={add}
            >
              <UI_ICONS.Plus size={22} color={tokens.fg} strokeWidth={2.2} />
            </HeaderIconButton>
          ),
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: tokens.bg }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 24 },
        ]}
      >
        {cards === undefined ? (
          <LoadingSkeleton rows={4} label={t.actions.loading} />
        ) : cards.length === 0 ? (
          <View testID="loyalty-card-empty" style={styles.empty}>
            <Text
              accessibilityRole="header"
              style={[TYPE.title, styles.bold, styles.center, { color: tokens.fg }]}
            >
              {words.index.emptyTitle}
            </Text>
            <Text style={[TYPE.lead, styles.center, { color: tokens.muted }]}>
              {fmt(words.index.emptyBody, { group: group.name })}
            </Text>
            <Button
              label={words.index.emptyAction}
              onPress={add}
              testID="loyalty-card-add-first"
            />
          </View>
        ) : (
          <>
            <SearchField
              value={query}
              onChangeText={setQuery}
              placeholder={words.index.filter}
              clearAccessibilityLabel={words.index.clearFilter}
              testID="loyalty-card-filter"
            />
            {problem ? (
              <Text
                accessibilityRole="alert"
                style={[TYPE.body, { color: tokens.danger }]}
              >
                {problem}
              </Text>
            ) : null}
            {matching.length === 0 ? (
              <View style={styles.notFound}>
                <Text
                  style={[TYPE.lead, styles.center, { color: tokens.muted }]}
                >
                  {words.index.filterEmpty}
                </Text>
                <Button
                  label={t.actions.showAll}
                  variant="secondary"
                  onPress={() => setQuery('')}
                  testID="loyalty-card-clear-filter"
                />
              </View>
            ) : (
              <Card>
                {matching.map((card, index) => (
                  <NativeContextMenu
                    key={card._id}
                    actions={[
                      { id: 'edit', title: words.till.edit, image: 'pencil' },
                      {
                        id: 'delete',
                        title: words.till.delete,
                        image: 'trash',
                        attributes: { destructive: true },
                      },
                    ]}
                    onAction={(action) => {
                      if (action === 'edit') {
                        router.push(
                          moduleHref('/all/loyalty-cards/edit', {
                            cardId: card._id,
                          }),
                        )
                      }
                      if (action === 'delete') {
                        setProblem(null)
                        deleteCard(card, { onFailed: setProblem })
                      }
                    }}
                  >
                    <CardRow
                      card={card}
                      last={index === matching.length - 1}
                      used={
                        card.lastUsedAt
                          ? fmt(words.index.usedAt, {
                              when: cardLastUsed(
                                card.lastUsedAt,
                                words.list.when,
                                locale,
                              ),
                            })
                          : words.index.neverUsed
                      }
                      onPress={() => open(card)}
                    />
                  </NativeContextMenu>
                ))}
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </>
  )
}

function CardRow({
  card,
  last,
  used,
  onPress,
}: {
  card: ListedCard
  last: boolean
  used: string
  onPress: () => void
}) {
  const tokens = useTokens('home')
  const detail = [card.holder, used].filter(Boolean).join(' · ')
  return (
    <Pressable
      testID={`loyalty-card-${card._id}`}
      accessibilityRole="button"
      accessibilityLabel={`${card.storeName}, ${detail}`}
      onPress={onPress}
      android_ripple={{ color: tokens.tile }}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: tokens.surface,
          borderBottomColor: tokens.border,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        },
        pressed && { backgroundColor: tokens.tile },
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
          style={[TYPE.lead, styles.bold, { color: tokens.fg }]}
        >
          {card.storeName}
        </Text>
        <Text numberOfLines={2} style={[TYPE.label, { color: tokens.muted }]}>
          {detail}
        </Text>
      </View>
      <UI_ICONS.ChevronRight size={18} color={tokens.muted} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 12, gap: 16 },
  empty: { gap: 14, paddingTop: 48, paddingHorizontal: 8 },
  notFound: { gap: 14, paddingVertical: 20 },
  center: { textAlign: 'center' },
  bold: { fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 68,
    marginHorizontal: -14,
    paddingHorizontal: 14,
  },
  rowText: { flex: 1, gap: 2, paddingVertical: 10 },
})
