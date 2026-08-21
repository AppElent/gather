/**
 * The four things worth watching over time, one card each.
 *
 * The log itself shows weight, because that is the one a parent checks between
 * appointments. This is where the rest live — height, head circumference and
 * temperature — rather than four charts stacked on the log, which would push
 * the thing the screen is for (logging) below the fold.
 *
 * Each card says so when there is nothing to draw. An empty card is more honest
 * than a hidden one: a screen that silently omits height reads as a screen that
 * does not track height.
 */
import { Stack } from 'expo-router'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useI18n } from '../../i18n'
import { useTokens } from '../../theme/tokens'
import { TREND_METRICS, TrendCard } from './TrendCard'
import { useBabyLog } from './useBabyLog'

export function TrendsScreen() {
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const { t } = useI18n()
  const log = useBabyLog()
  const text = t.baby.log.status

  const cards = [
    { key: 'weight', title: text.weight, metric: TREND_METRICS.weight },
    { key: 'height', title: text.height, metric: TREND_METRICS.height },
    { key: 'head', title: text.head, metric: TREND_METRICS.head },
    {
      key: 'temperature',
      title: text.temperature,
      metric: TREND_METRICS.temperature,
    },
  ]

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: text.allTrends }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: tokens.bg }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 24 },
        ]}
      >
        {log.child ? (
          <Text style={[styles.subject, { color: tokens.muted }]}>
            {log.child.name}
          </Text>
        ) : null}

        <View style={styles.cards}>
          {cards.map((card) => (
            <TrendCard
              key={card.key}
              events={log.events ?? []}
              title={card.title}
              metric={card.metric}
            />
          ))}
        </View>
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 14 },
  subject: { fontSize: 13, marginBottom: 4 },
  cards: { gap: 10 },
})
