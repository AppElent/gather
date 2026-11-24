/**
 * Sources (APP-495, designs/energy section 8): what feeds the address. Each
 * source with its state in words (`danger` when it needs care, with when its
 * data is from), each channel with the one source it comes from, and the
 * sources to add. Connecting Home Assistant is for admins.
 */
import {
  energyChannelRows,
  energyManualLine,
  energySourceLine,
} from '@gather/core/energy-present'
import type { FunctionReturnType } from 'convex/server'
import { Stack, useRouter } from 'expo-router'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { api } from '../../convex/api'
import { useQuery } from '../../convex/queries'
import { useGroup } from '../../group/GroupProvider'
import { fmt, plural, useI18n } from '../../i18n'
import { moduleHref } from '../../modules/moduleDestination'
import { SPACE, TYPE, useTokens } from '../../theme/tokens'
import { InsetList, InsetRow } from '../../ui/inset-list'
import { moduleTile } from '../../ui/module-tile'
import { washScreenOptions } from '../../ui/screen-header'
import { SectionLabel } from '../../ui/section-label'
import { WashHeader } from '../../ui/wash-header'

type SourceList = NonNullable<FunctionReturnType<typeof api.energySources.list>>

export function EnergySourcesScreen() {
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const { t, locale } = useI18n()
  const { group } = useGroup()
  const words = t.energy
  const list = useQuery(api.energySources.list, { groupSlug: group.slug })
  const tile = moduleTile('energy')

  return (
    <>
      <Stack.Screen options={washScreenOptions(words.sources.title)} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: tokens.ground }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        {tile && list ? (
          <WashHeader
            group={tile.group}
            glyph={tile.glyph}
            summary={{
              count: list.siteName,
              sub: fmt(words.sources.summary, {
                sources: plural(
                  locale,
                  list.sources.length,
                  words.sources.countSources,
                ),
                channels: plural(
                  locale,
                  list.channels.length,
                  words.sources.countChannels,
                ),
              }),
            }}
          />
        ) : null}
        <View style={styles.content}>
          {list === undefined ? (
            <LoadingSkeleton rows={4} label={t.actions.loading} />
          ) : list === null ? (
            <Text style={[TYPE.body, { color: tokens.muted }]}>
              {words.empty.summary}
            </Text>
          ) : (
            <Sources list={list} />
          )}
        </View>
      </ScrollView>
    </>
  )
}

function Sources({ list }: { list: SourceList }) {
  const tokens = useTokens('home')
  const { t, locale } = useI18n()
  const router = useRouter()
  const words = t.energy
  const copy = words.sources
  const now = Date.now()
  const rows = energyChannelRows(list.channels, words)
  const label = new Map<string, string>(
    list.sources.map((each) => [each._id, each.label]),
  )
  const homeAssistant = list.sources.some(
    (each) => each.kind === 'homeAssistant',
  )
  const open = (path: '/all/energy/readings' | '/all/energy/connect') =>
    router.push(moduleHref(path))

  return (
    <>
      <View style={styles.section}>
        <SectionLabel>{copy.heading}</SectionLabel>
        {list.sources.length === 0 ? (
          <Text style={[TYPE.subhead, styles.note, { color: tokens.muted }]}>
            {copy.none}
          </Text>
        ) : (
          <InsetList testID="energy-sources">
            {list.sources.map((source) => {
              const manual = source.kind === 'manual'
              const line = manual
                ? energyManualLine(source.readings, now, words, locale)
                : energySourceLine(source, now, words, locale)
              const path = manual
                ? ('/all/energy/readings' as const)
                : list.canManage
                  ? ('/all/energy/connect' as const)
                  : null
              return (
                <InsetRow
                  key={source._id}
                  testID={`energy-source-row-${source.kind}`}
                  title={source.label}
                  subtitle={line.text}
                  subtitleTone={line.problem ? 'danger' : 'muted'}
                  chevron={path !== null}
                  onPress={path ? () => open(path) : undefined}
                />
              )
            })}
          </InsetList>
        )}
      </View>

      <View style={styles.section}>
        <SectionLabel>{copy.channelsHeading}</SectionLabel>
        {rows.length === 0 ? (
          <Text style={[TYPE.subhead, styles.note, { color: tokens.muted }]}>
            {copy.channelsNone}
          </Text>
        ) : (
          <InsetList testID="energy-channels">
            {rows.map((row) => (
              <InsetRow
                key={row.key}
                title={row.name}
                // Under the name, not beside it, so neither is squeezed at a
                // large text size.
                subtitle={label.get(row.sourceId)}
              />
            ))}
          </InsetList>
        )}
        <Text style={[TYPE.footnote, styles.note, { color: tokens.muted }]}>
          {copy.channelsNote}
        </Text>
      </View>

      <View style={styles.section}>
        <SectionLabel>{copy.addHeading}</SectionLabel>
        <InsetList testID="energy-add-source">
          {homeAssistant ? null : (
            <InsetRow
              key="homeAssistant"
              testID="energy-add-home-assistant"
              title={words.connect.title}
              subtitle={
                list.canManage ? copy.addHomeAssistantSub : copy.adminsConnect
              }
              chevron={list.canManage}
              onPress={
                list.canManage ? () => open('/all/energy/connect') : undefined
              }
            />
          )}
          <InsetRow
            key="manual"
            testID="energy-add-manual"
            title={words.readings.title}
            subtitle={copy.addManualSub}
            chevron
            onPress={() => open('/all/energy/readings')}
          />
          <InsetRow key="enelogic" title={copy.enelogic} subtitle={copy.soon} />
          <InsetRow
            key="homeWizard"
            title={copy.homeWizard}
            subtitle={copy.homeWizardSoon}
          />
        </InsetList>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SPACE[4], gap: SPACE[5] },
  section: { gap: SPACE[2] },
  note: { paddingHorizontal: 4 },
})
