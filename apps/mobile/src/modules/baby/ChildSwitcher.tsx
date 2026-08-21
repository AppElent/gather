/**
 * The sheet behind the child's name in the header.
 *
 * This is the list-of-children screen, and it is a sheet rather than a
 * destination on purpose: with one Child — which is most households — a list
 * you pass through on the way in is a tap that never pays, so the Module opens
 * on a log and the list is somewhere you go only when you actually want to
 * switch.
 *
 * It is also where a Child is **edited from**, because this is the only screen
 * that lists them: a name or a birth date you can set once and never correct is
 * a typo somebody lives with. The row switches; the pencil beside it opens that
 * Child's settings, which is the same screen Settings -> Modules -> Baby log
 * reaches (ADR-0022) rather than a second copy of it.
 *
 * The frame - drag-to-dismiss, close button, scrim - is `Sheet`'s.
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { Sheet } from '../../components/Sheet'
import { fmt, useI18n } from '../../i18n'
import { UI_ICONS } from '../../theme/icons'
import { useTokens } from '../../theme/tokens'
import { BABY_UI_ICONS } from './icons'

export interface SwitchableChild {
  _id: string
  name: string
}

export interface ChildSwitcherProps {
  /** Named `items` rather than `children` — React's prop of that name is not this. */
  items: readonly SwitchableChild[]
  selectedId: string
  onSelect: (childId: string) => void
  onEdit: (childId: string) => void
  onAdd: () => void
  onClose: () => void
}

export function ChildSwitcher({
  items,
  selectedId,
  onSelect,
  onEdit,
  onAdd,
  onClose,
}: ChildSwitcherProps) {
  const tokens = useTokens('home')
  const { t } = useI18n()
  const tint = tokens.tintOf('home')

  return (
    <Sheet title={t.baby.log.child.switch} onClose={onClose} maxHeight={0.72}>
      <ScrollView contentContainerStyle={styles.list}>
        {items.map((item) => {
          const selected = item._id === selectedId
          return (
            <View
              key={item._id}
              style={[styles.row, { borderBottomColor: tokens.border }]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => onSelect(item._id)}
                style={({ pressed }) => [
                  styles.rowMain,
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.avatar, { backgroundColor: tint.bg }]}>
                  <BABY_UI_ICONS.Baby
                    size={19}
                    color={tint.fg}
                    strokeWidth={1.8}
                  />
                </View>
                <Text style={[styles.name, { color: tokens.fg }]}>
                  {item.name}
                </Text>
                {selected ? (
                  <UI_ICONS.Check size={20} color={tint.fg} strokeWidth={2.4} />
                ) : null}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={fmt(t.baby.log.child.edit, {
                  name: item.name,
                })}
                onPress={() => onEdit(item._id)}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.edit,
                  { backgroundColor: tokens.tile },
                  pressed && styles.pressed,
                ]}
              >
                <UI_ICONS.Pencil
                  size={17}
                  color={tokens.muted}
                  strokeWidth={1.9}
                />
              </Pressable>
            </View>
          )
        })}

        <Pressable
          accessibilityRole="button"
          onPress={onAdd}
          style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}
        >
          <View
            style={[
              styles.avatar,
              styles.avatarDashed,
              { borderColor: tokens.border },
            ]}
          >
            <BABY_UI_ICONS.Plus
              size={19}
              color={tokens.muted}
              strokeWidth={2.2}
            />
          </View>
          <Text style={[styles.name, { color: tokens.muted }]}>
            {t.baby.log.list.addChild}
          </Text>
        </Pressable>
      </ScrollView>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  list: { paddingBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'transparent',
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
  },
  edit: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarDashed: { borderWidth: 1, borderStyle: 'dashed' },
  name: { flex: 1, fontSize: 16.5, fontWeight: '600' },
  pressed: { opacity: 0.6 },
})
