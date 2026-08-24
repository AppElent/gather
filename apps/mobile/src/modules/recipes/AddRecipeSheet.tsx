/**
 * Two ways to add a recipe, offered where the collection is.
 *
 * The Add tab's launcher offers importing and nothing else, because that is
 * what a phone is for here: you found a recipe, and it is in your hand. Writing
 * one out by hand is the laptop's job — but a handwritten card from somebody's
 * mother is not a laptop's job either, and a Module that could only import
 * would be a dead end for it. So blank authoring is **reachable but not
 * advertised**: it lives one level in, behind the collection's own add control,
 * beside the thing most people came for.
 *
 * A sheet with two rows rather than a menu, for `PhotoField`'s reason: two
 * answers do not need a menu in front of them. The rows carry a line of
 * explanation each because "Write it yourself" beside "Import from a link" is
 * ambiguous about which one is the quick one.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { NativeSheet } from '../../components/NativeSheet'
import { useI18n } from '../../i18n'
import { UI_ICONS } from '../../theme/icons'
import { RADIUS, useTokens } from '../../theme/tokens'
import { RECIPE_UI_ICONS } from './icons'

export interface AddRecipeSheetProps {
  onImport: () => void
  onBlank: () => void
  onClose: () => void
}

export function AddRecipeSheet({
  onImport,
  onBlank,
  onClose,
}: AddRecipeSheetProps) {
  const tokens = useTokens('kitchen')
  const tint = tokens.tintOf('kitchen')
  const { t } = useI18n()
  const text = t.recipes.create

  const rows = [
    {
      id: 'import',
      label: text.chooseImport,
      body: text.chooseImportBody,
      Icon: UI_ICONS.ImagePlus,
      onPress: onImport,
    },
    {
      id: 'blank',
      label: text.chooseBlank,
      body: text.chooseBlankBody,
      Icon: RECIPE_UI_ICONS.ChefHat,
      onPress: onBlank,
    },
  ] as const

  return (
    <NativeSheet title={text.chooseTitle} onClose={onClose}>
      <View style={styles.rows}>
        {rows.map(({ id, label, body, Icon, onPress }) => (
          <Pressable
            key={id}
            accessibilityRole="button"
            accessibilityLabel={label}
            testID={`recipe-add-${id}`}
            onPress={onPress}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={[styles.icon, { backgroundColor: tint.bg }]}>
              <Icon size={20} color={tint.fg} strokeWidth={1.8} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.label, { color: tokens.fg }]}>{label}</Text>
              <Text style={[styles.body, { color: tokens.muted }]}>{body}</Text>
            </View>
            <UI_ICONS.ChevronRight
              size={18}
              color={tokens.muted}
              strokeWidth={2.2}
            />
          </Pressable>
        ))}
      </View>
    </NativeSheet>
  )
}

const styles = StyleSheet.create({
  rows: { gap: 2, paddingBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.tile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 1 },
  label: { fontSize: 16, fontWeight: '600' },
  body: { fontSize: 13 },
  pressed: { opacity: 0.6 },
})
