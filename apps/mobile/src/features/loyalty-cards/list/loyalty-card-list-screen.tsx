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
import { type ComponentProps, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { LoadingSkeleton } from '../../../components/LoadingSkeleton'
import { SearchField } from '../../../components/SearchField'
import { api } from '../../../convex/api'
import { useQuery } from '../../../convex/queries'
import { useGroup } from '../../../group/GroupProvider'
import { fmt, plural, useI18n } from '../../../i18n'
import { moduleHref } from '../../../modules/moduleDestination'
import { UI_ICONS } from '../../../theme/icons'
import { SPACE, TYPE, useTokens } from '../../../theme/tokens'
import { Button } from '../../../ui/button'
import { HeaderIconButton } from '../../../ui/header-icon-button'
import { InsetList, InsetRow } from '../../../ui/inset-list'
import { moduleTile } from '../../../ui/module-tile'
import { washScreenOptions } from '../../../ui/screen-header'
import { WashHeader } from '../../../ui/wash-header'
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
  const tile = moduleTile('loyalty-cards')
  const open = (card: ListedCard) =>
    router.push(moduleHref('/all/loyalty-cards/card', { cardId: card._id }))

  return (
    <>
      <Stack.Screen
        options={{
          ...washScreenOptions(t.modules.byId['loyalty-cards'].label),
          headerRight: () => (
            <HeaderIconButton
              label={words.index.add}
              testID="loyalty-card-add"
              onPress={add}
            >
              <UI_ICONS.Plus size={22} color={tokens.ink} strokeWidth={2.2} />
            </HeaderIconButton>
          ),
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: tokens.ground }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        {tile && cards !== undefined ? (
          <WashHeader
            group={tile.group}
            glyph={tile.glyph}
            summary={{
              count: plural(locale, cards.length, words.index.count),
              scope: group.name,
            }}
          />
        ) : null}
        <View style={styles.content}>
          {cards === undefined ? (
            <LoadingSkeleton rows={4} label={t.actions.loading} />
          ) : cards.length === 0 ? (
            <View testID="loyalty-card-empty" style={styles.empty}>
              <Text
                accessibilityRole="header"
                style={[TYPE.title2, styles.center, { color: tokens.ink }]}
              >
                {words.index.emptyTitle}
              </Text>
              <Text style={[TYPE.body, styles.center, { color: tokens.muted }]}>
                {fmt(words.index.emptyBody, { group: group.name })}
              </Text>
              <Button
                label={words.index.emptyAction}
                group="home"
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
                  style={[TYPE.subhead, { color: tokens.danger }]}
                >
                  {problem}
                </Text>
              ) : null}
              {matching.length === 0 ? (
                <View style={styles.notFound}>
                  <Text
                    style={[TYPE.body, styles.center, { color: tokens.muted }]}
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
                <InsetList>
                  {matching.map((card) => (
                    <CardRow
                      key={card._id}
                      card={card}
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
                      menu={{
                        actions: [
                          {
                            id: 'edit',
                            title: words.till.edit,
                            image: 'pencil',
                          },
                          {
                            id: 'delete',
                            title: words.till.delete,
                            image: 'trash',
                            attributes: { destructive: true },
                          },
                        ],
                        onAction: (action) => {
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
                        },
                      }}
                    />
                  ))}
                </InsetList>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </>
  )
}

function CardRow({
  card,
  used,
  onPress,
  menu,
}: {
  card: ListedCard
  used: string
  onPress: () => void
  menu: ComponentProps<typeof InsetRow>['menu']
}) {
  const detail = [card.holder, used].filter(Boolean).join(' · ')
  return (
    <InsetRow
      testID={`loyalty-card-${card._id}`}
      accessibilityLabel={`${card.storeName}, ${detail}`}
      onPress={onPress}
      menu={menu}
      chevron
      leading={
        <StoreTile
          name={card.storeName}
          color={card.brandColor}
          catalogKey={card.catalogKey}
          size="medium"
        />
      }
      title={card.storeName}
      subtitle={detail}
    />
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SPACE[4], gap: SPACE[4] },
  empty: { gap: 14, paddingTop: 48, paddingHorizontal: 8 },
  notFound: { gap: 14, paddingVertical: 20 },
  center: { textAlign: 'center' },
})
