/**
 * Everything logged for a Child, newest first, grouped by day.
 *
 * Every entry stays here regardless of what the Child currently tracks: tracked
 * types decide what is *offered*, never what is shown (ADR-0022). A parent who
 * stopped tracking medication still has the twelve medication entries they may
 * need to show a doctor.
 *
 * A row is a way in, not a label. The summary under each one is a sentence —
 * "37.8 °C, rectal" — and a sentence is a summary of something, so pressing it
 * opens that something: the whole entry, with its notes, and the two things you
 * can do about it (`EntryScreen`).
 */
import { Stack, useRouter } from 'expo-router'
import { useMemo } from 'react'
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { fmt, useI18n } from '../../i18n'
import { UI_ICONS } from '../../theme/icons'
import { useTokens } from '../../theme/tokens'
import { EVENT_ICONS } from './icons'
import type { BabyBase } from './paths'
import { babyHref } from './paths'
import { summarize } from './summarize'
import { useBabyLog } from './useBabyLog'

export interface TimelineScreenProps {
  /** Which tab stack this instance is mounted in (ADR-0023). */
  base: BabyBase
}

export function TimelineScreen({ base }: TimelineScreenProps) {
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { t, locale } = useI18n()
  const log = useBabyLog()
  const tint = tokens.tintOf('home')

  const sections = useMemo(() => {
    const byDay = new Map<
      string,
      typeof log.events extends undefined
        ? never
        : NonNullable<typeof log.events>
    >()
    for (const event of log.events ?? []) {
      const key = new Date(event.timestamp).toDateString()
      const bucket = byDay.get(key)
      if (bucket) bucket.push(event)
      else byDay.set(key, [event])
    }
    return [...byDay.entries()]
      .sort((a, b) => Date.parse(b[0]) - Date.parse(a[0]))
      .map(([day, data]) => ({
        title: new Date(day).toLocaleDateString(locale, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        }),
        data: [...data].sort((a, b) => b.timestamp - a.timestamp),
      }))
  }, [log.events, locale])

  return (
    <>
      <Stack.Screen
        options={{ headerShown: true, title: t.baby.log.timeline.title }}
      />
      <SectionList
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: tokens.bg }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 24 },
        ]}
        sections={sections}
        keyExtractor={(item) => item._id}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: tokens.muted }]}>
            {t.baby.log.timeline.empty}
          </Text>
        }
        renderSectionHeader={({ section }) => (
          <Text style={[styles.day, { color: tokens.muted }]}>
            {section.title.toUpperCase()}
          </Text>
        )}
        renderItem={({ item }) => {
          const Icon = EVENT_ICONS[item.type]
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={fmt(t.baby.log.timeline.openEntry, {
                type: t.baby.eventTypes[item.type],
              })}
              onPress={() =>
                router.push(babyHref(base, '/entry', { entryId: item._id }))
              }
              style={({ pressed }) => [
                styles.row,
                { borderBottomColor: tokens.border },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.time, { color: tokens.muted }]}>
                {new Date(item.timestamp).toLocaleTimeString(locale, {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
              <View style={[styles.glyph, { backgroundColor: tint.bg }]}>
                <Icon size={17} color={tint.fg} strokeWidth={1.9} />
              </View>
              <View style={styles.text}>
                <Text style={[styles.title, { color: tokens.fg }]}>
                  {t.baby.eventTypes[item.type]}
                </Text>
                <Text style={[styles.detail, { color: tokens.muted }]}>
                  {summarize(item, t.baby.log.summary, t.baby.log.options)}
                </Text>
              </View>
              <UI_ICONS.ChevronRight
                size={17}
                color={tokens.muted}
                strokeWidth={2.2}
              />
            </Pressable>
          )
        }}
      />
    </>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 12 },
  day: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    paddingTop: 14,
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  // Wide enough for a 12-hour clock: "9:18 AM" wrapped to two lines at the
  // width a 24-hour "09:18" needs, and the locale decides which one this is.
  time: { width: 62, fontSize: 13 },
  glyph: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 1 },
  title: { fontSize: 15, fontWeight: '600' },
  detail: { fontSize: 13 },
  empty: { fontSize: 15, textAlign: 'center', paddingVertical: 40 },
  pressed: { opacity: 0.6 },
})
