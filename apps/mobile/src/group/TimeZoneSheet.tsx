/** Every time zone, searched by name: the Group's zone is one of them (APP-779). */
import {
  currentZoneName,
  deviceTimeZone,
  listTimeZones,
  searchTimeZones,
  sortTimeZones,
  timeZoneName,
  timeZonePlace,
} from '@gather/core/time-zones'
import { useMemo, useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'

import { NativeSheet } from '../components/NativeSheet'
import { SearchField } from '../components/SearchField'
import { fmt, useI18n } from '../i18n'
import { UI_ICONS } from '../theme/icons'
import { SIZE, SPACE, TYPE, useTokens } from '../theme/tokens'
import { InsetListItem, useInsetSeparator } from '../ui/inset-list'
import { radioProps } from '../ui/radio-props'

export function TimeZoneSheet({
  selected,
  onChoose,
  onClose,
}: {
  selected: string | undefined
  onChoose: (zone: string) => void
  onClose: () => void
}) {
  const tokens = useTokens()
  const { t, locale } = useI18n()
  const text = t.shell.groups.timeZone
  const current = selected && currentZoneName(selected)
  const [query, setQuery] = useState('')
  const zones = useMemo(
    () =>
      sortTimeZones(
        listTimeZones(deviceTimeZone(), selected),
        locale,
        text.places,
      ),
    [selected, locale, text.places],
  )
  const shown = useMemo(
    () => searchTimeZones(zones, query, locale, text.places),
    [zones, query, locale, text.places],
  )

  return (
    <NativeSheet
      title={text.choose}
      onClose={onClose}
      maxHeight={0.9}
      fill
      background="ground"
    >
      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder={text.search}
        clearAccessibilityLabel={t.search.clear}
        testID="time-zone-search"
      />
      <FlatList
        data={shown}
        keyExtractor={(zone) => zone}
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        style={styles.list}
        contentContainerStyle={styles.content}
        ListEmptyComponent={
          <Text
            accessibilityLiveRegion="polite"
            style={[styles.empty, { color: tokens.muted }]}
          >
            {fmt(text.noMatches, { query: query.trim() })}
          </Text>
        }
        renderItem={({ item, index }) => (
          <InsetListItem index={index} count={shown.length}>
            <ZoneRow
              zone={item}
              selected={item === current}
              onPress={() => onChoose(item)}
            />
          </InsetListItem>
        )}
      />
    </NativeSheet>
  )
}

function ZoneRow({
  zone,
  selected,
  onPress,
}: {
  zone: string
  selected: boolean
  onPress: () => void
}) {
  const tokens = useTokens()
  const { t, locale } = useI18n()
  const place = timeZonePlace(zone, t.shell.groups.timeZone.places)
  const name = timeZoneName(zone, locale)
  const separator = useInsetSeparator()
  return (
    <Pressable
      testID={`time-zone-${zone}`}
      {...radioProps(selected, t.a11y.radioButton)}
      accessibilityLabel={name ? `${place}, ${name}` : place}
      android_ripple={{ color: tokens.surface2 }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: tokens.surface2 },
      ]}
    >
      <View style={[styles.rowContent, separator]}>
        <View style={styles.text}>
          <Text style={[styles.place, { color: tokens.ink }]}>{place}</Text>
          {name ? (
            <Text style={[styles.name, { color: tokens.muted }]}>{name}</Text>
          ) : null}
        </View>
        {selected ? <UI_ICONS.Check size={20} color={tokens.ink} /> : null}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  // Each row brings its own margin and the list runs to the sheet's bottom edge.
  list: {
    flex: 1,
    marginTop: SPACE[3],
    marginHorizontal: -SPACE[4],
    marginBottom: -20,
  },
  content: { paddingBottom: SPACE[6] },
  row: { paddingLeft: SPACE[4] },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE[3],
    minHeight: SIZE.rowMin,
    paddingRight: SPACE[4],
  },
  text: { flex: 1, paddingVertical: SPACE[2] },
  place: { ...TYPE.body },
  name: { ...TYPE.footnote },
  empty: { ...TYPE.subhead, textAlign: 'center', paddingVertical: SPACE[4] },
})
