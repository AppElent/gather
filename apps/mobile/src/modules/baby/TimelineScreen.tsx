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

import { asBabyEvent, summarizeBabyEvent } from '@gather/core/baby-events'
import type { Messages } from '@gather/core/messages'
import { useMutation } from 'convex/react'
import { Stack, useRouter } from 'expo-router'
import { SectionList, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api, type Id } from '../../convex/api'
import { confirmDestructive } from '../../feedback/confirmDestructive'
import { haptics } from '../../feedback/haptics'
import { fmt, plural, useI18n } from '../../i18n'
import { SPACE, TABULAR, TYPE, useTokens } from '../../theme/tokens'
import { InsetListItem, InsetRow } from '../../ui/inset-list'
import { ModuleTile, moduleTile } from '../../ui/module-tile'
import { washScreenOptions } from '../../ui/screen-header'
import { SectionLabel } from '../../ui/section-label'
import { WashHeader } from '../../ui/wash-header'
import { moduleHref } from '../moduleDestination'
import { EVENT_ICONS } from './icons'
import { useBabyLog } from './useBabyLog'

/** A row has no notes line of its own, so a note's text is what the row says. */
function rowDetail(
  item: Parameters<typeof summarizeBabyEvent>[0] & { notes?: string },
  log: Messages['baby']['log'],
): string {
  const summary = summarizeBabyEvent(item, log)
  const event = asBabyEvent(item)
  if (event.type !== 'note') return summary
  const text = event.notes?.trim()
  if (!text) return summary
  return event.data.milestone ? `${summary} · ${text}` : text
}

export function TimelineScreen() {
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { t, locale } = useI18n()
  const log = useBabyLog()
  const events = log.events
  const tile = moduleTile('baby-log')
  const remove = useMutation(api.babyEvents.remove)

  function confirmDelete(item: NonNullable<typeof log.events>[number]) {
    confirmDestructive({
      title: t.baby.log.timeline.deleteTitle,
      message: fmt(t.baby.log.timeline.deleteEntry, {
        type: t.baby.eventTypes[item.type],
      }),
      confirm: t.baby.log.timeline.deleteConfirm,
      cancel: t.common.actions.cancel,
      onConfirm: () =>
        remove({
          eventId: item._id as Id<'babyEvents'>,
          groupSlug: log.groupSlug,
        }).catch(() => haptics.actionFailed()),
    })
  }

  const sections = (() => {
    const byDay = new Map<
      string,
      typeof log.events extends undefined
        ? never
        : NonNullable<typeof log.events>
    >()
    for (const event of events ?? []) {
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
  })()

  return (
    <>
      <Stack.Screen options={washScreenOptions(t.baby.log.timeline.title)} />
      <SectionList
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: tokens.ground }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        sections={sections}
        keyExtractor={(item) => item._id}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          tile ? (
            <WashHeader
              group={tile.group}
              glyph={tile.glyph}
              summary={{
                count: plural(
                  locale,
                  events?.length ?? 0,
                  t.baby.log.timeline.count,
                ),
                scope: log.child?.name,
              }}
            />
          ) : undefined
        }
        ListEmptyComponent={
          <Text style={[styles.empty, { color: tokens.muted }]}>
            {t.baby.log.timeline.empty}
          </Text>
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.day}>
            <SectionLabel>{section.title}</SectionLabel>
          </View>
        )}
        renderItem={({ item, index, section }) => {
          const open = () =>
            router.push(
              moduleHref('/all/baby-log/entry', { entryId: item._id }),
            )
          return (
            <InsetListItem index={index} count={section.data.length}>
              <InsetRow
                accessibilityLabel={fmt(t.baby.log.timeline.openEntry, {
                  type: t.baby.eventTypes[item.type],
                })}
                onPress={open}
                onDelete={() => confirmDelete(item)}
                deleteLabel={t.common.actions.delete}
                menu={{
                  actions: [
                    { id: 'edit', title: t.common.actions.edit },
                    {
                      id: 'delete',
                      title: t.common.actions.delete,
                      attributes: { destructive: true },
                    },
                  ],
                  onAction: (action) => {
                    if (action === 'edit') open()
                    if (action === 'delete') confirmDelete(item)
                  },
                }}
                leading={
                  <ModuleTile
                    group="home"
                    glyph={EVENT_ICONS[item.type]}
                    size="s"
                  />
                }
                title={t.baby.eventTypes[item.type]}
                subtitle={rowDetail(item, t.baby.log)}
                trailing={
                  <Text style={[styles.time, { color: tokens.muted }]}>
                    {new Date(item.timestamp).toLocaleTimeString(locale, {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                }
                chevron
              />
            </InsetListItem>
          )
        }}
      />
    </>
  )
}

const styles = StyleSheet.create({
  day: {
    paddingHorizontal: SPACE[4],
    paddingTop: SPACE[4],
    paddingBottom: SPACE[2],
  },
  time: { ...TYPE.footnote, ...TABULAR },
  empty: { ...TYPE.subhead, textAlign: 'center', paddingVertical: 40 },
})
