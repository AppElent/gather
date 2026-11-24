/** Every time zone, searched by name: the Group's zone is one of them (APP-779). */
import {
  deviceTimeZone,
  listTimeZones,
  searchTimeZones,
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
  const { t } = useI18n()
  const text = t.shell.groups.timeZone
  const [query, setQuery] = useState('')
  const zones = useMemo(
    () => listTimeZones(deviceTimeZone(), selected),
    [selected],
  )
  const shown = useMemo(() => searchTimeZones(zones, query), [zones, query])

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
              selected={item === selected}
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
  const { t } = useI18n()
  const separator = useInsetSeparator()
  return (
    <Pressable
      testID={`time-zone-${zone}`}
      {...radioProps(selected, t.a11y.radioButton)}
      accessibilityLabel={zone}
      android_ripple={{ color: tokens.surface2 }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: tokens.surface2 },
      ]}
    >
      <View style={[styles.rowContent, separator]}>
        <Text style={[styles.name, { color: tokens.ink }]}>{zone}</Text>
        {selected ? <UI_ICONS.Check size={20} color={tokens.ink} /> : null}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  list: { flex: 1, marginTop: SPACE[3] },
  content: { paddingBottom: SPACE[6] },
  row: { paddingLeft: SPACE[4] },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE[3],
    minHeight: SIZE.rowMin,
    paddingRight: SPACE[4],
  },
  name: { ...TYPE.body, flex: 1 },
  empty: { ...TYPE.subhead, textAlign: 'center', paddingVertical: SPACE[4] },
})
