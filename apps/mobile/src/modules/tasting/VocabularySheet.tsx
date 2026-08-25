/**
 * A long vocabulary, as a list you scroll and search.
 *
 * Twenty-eight wine regions in a chip row is a wall; the same twenty-eight in
 * a sheet is a list, which is what a phone is good at. Which vocabularies get
 * this is not a per-field decision — `tastingSelectPresentation` answers it off
 * the vocabulary's own length, so the two clients cannot disagree.
 *
 * "Not set" is the first row rather than a Clear button in the corner: clearing
 * a field is choosing an answer, not undoing one, and it belongs among the
 * answers.
 */
import {
  TASTING_VOCABULARIES,
  type TastingVocabularyId,
} from '@gather/core/tastings'
import { useMemo, useState } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { NativeSheet } from '../../components/NativeSheet'
import { haptics } from '../../feedback/haptics'
import { useI18n } from '../../i18n'
import { UI_ICONS } from '../../theme/icons'
import { RADIUS, useTokens } from '../../theme/tokens'
import { term } from './words'

export function VocabularySheet({
  title,
  vocabulary,
  selected,
  onSelect,
  onClose,
}: {
  title: string
  vocabulary: TastingVocabularyId
  selected: string | undefined
  /** `null` clears the field. */
  onSelect: (key: string | null) => void
  onClose: () => void
}) {
  const tokens = useTokens('tasting')
  const { t } = useI18n()
  const tint = tokens.tintOf('tasting')
  const Check = UI_ICONS.Check
  const Search = UI_ICONS.Search
  const [query, setQuery] = useState('')

  const options = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return (TASTING_VOCABULARIES[vocabulary] as readonly string[])
      .map((key) => ({ key, label: term(t.tastings, vocabulary, key) }))
      .filter(({ label }) => !needle || label.toLowerCase().includes(needle))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [vocabulary, query, t])

  function choose(key: string | null) {
    haptics.selectionChanged()
    onSelect(key)
  }

  function Row({
    label,
    on,
    onPress,
  }: {
    label: string
    on: boolean
    onPress: () => void
  }) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        accessibilityLabel={label}
        onPress={onPress}
        style={({ pressed }) => [
          styles.row,
          { borderBottomColor: tokens.border },
          pressed && { backgroundColor: tokens.tile },
        ]}
      >
        <Text style={[styles.rowLabel, { color: tokens.fg }]}>{label}</Text>
        {on ? <Check size={18} color={tint.fg} strokeWidth={2.4} /> : null}
      </Pressable>
    )
  }

  return (
    <NativeSheet title={title} onClose={onClose} maxHeight={0.7} fill>
      <View
        style={[
          styles.search,
          { backgroundColor: tokens.tile, borderColor: tokens.border },
        ]}
      >
        <Search size={17} color={tokens.muted} strokeWidth={2} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t.tastings.index.search}
          placeholderTextColor={tokens.muted}
          accessibilityLabel={t.tastings.index.search}
          style={[styles.searchInput, { color: tokens.fg }]}
        />
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" style={styles.list}>
        <Row
          label={t.tastings.composer.none}
          on={selected === undefined}
          onPress={() => choose(null)}
        />
        {options.map(({ key, label }) => (
          <Row
            key={key}
            label={label}
            on={selected === key}
            onPress={() => choose(key)}
          />
        ))}
        {options.length === 0 ? (
          <Text style={[styles.empty, { color: tokens.muted }]}>
            {t.tastings.index.searchEmpty}
          </Text>
        ) : null}
      </ScrollView>
    </NativeSheet>
  )
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: RADIUS.control,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, fontSize: 16 },
  list: { marginTop: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { fontSize: 16 },
  empty: { paddingVertical: 16, fontSize: 15 },
})
