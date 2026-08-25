import { useQuery } from 'convex/react'
import { Stack } from 'expo-router'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { useGroup } from '../../group/GroupProvider'
import { useI18n } from '../../i18n'
import { useRecordRecent } from '../../search/recentRecords'
import { RADIUS, useTokens } from '../../theme/tokens'

function time(value?: number) {
  if (value === undefined) return null
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
}

export function CalendarEventScreen({ eventId }: { eventId: string }) {
  const { group } = useGroup()
  const { t, locale } = useI18n()
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const event = useQuery(api.kitchen.getCalendarEvent, {
    groupSlug: group.slug,
    id: eventId as Id<'calendarEvents'>,
  })
  useRecordRecent(
    event && event !== null
      ? {
          id: event._id,
          type: 'calendarEvent',
          title: event.title,
          detail: event.date,
        }
      : null,
  )

  if (event === undefined)
    return <View style={{ flex: 1, backgroundColor: tokens.bg }} />
  if (event === null)
    return (
      <>
        <Stack.Screen
          options={{ headerShown: true, title: t.modules.byId.calendar.label }}
        />
        <View style={[styles.center, { backgroundColor: tokens.bg }]}>
          <Text style={{ color: tokens.muted }}>{t.search.noResults}</Text>
        </View>
      </>
    )

  const start = time(event.startMinutes)
  const end = time(event.endMinutes)
  const when = new Date(`${event.date}T12:00:00`).toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: event.title }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: tokens.bg }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 24 },
        ]}
      >
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: tokens.fg }]}
        >
          {event.title}
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: tokens.surface, borderColor: tokens.border },
          ]}
        >
          <Text style={[styles.label, { color: tokens.muted }]}>
            {event.calendarName}
          </Text>
          <Text style={[styles.value, { color: tokens.fg }]}>{when}</Text>
          {start && end ? (
            <Text
              style={[styles.value, { color: tokens.fg }]}
            >{`${start}–${end}`}</Text>
          ) : null}
        </View>
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 16, paddingTop: 12, gap: 14 },
  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.6 },
  card: {
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.card,
    padding: 14,
  },
  label: { fontSize: 13.5 },
  value: { fontSize: 16 },
})
