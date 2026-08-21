/**
 * Settings → Modules → Baby log: the Group's children, and a way into each.
 *
 * A Module's own preferences live inside Settings and never beside it
 * (ADR-0018), and what Baby log has to configure belongs to a Child rather than
 * to the household — so this is a list that drills into the same Child screen
 * the Module itself reaches (ADR-0022).
 */
import { useQuery } from 'convex/react'
import { Stack, useRouter } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { api } from '../../../../../../../convex/_generated/api'
import { useGroup } from '../../../../../src/group/GroupProvider'
import { useI18n } from '../../../../../src/i18n'
import { UI_ICONS } from '../../../../../src/theme/icons'
import { RADIUS, useTokens } from '../../../../../src/theme/tokens'

export default function BabyLogSettings() {
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const { t } = useI18n()
  const router = useRouter()
  const { group } = useGroup()
  const children = useQuery(api.babies.list, { groupSlug: group.slug })

  return (
    <>
      <Stack.Screen
        options={{ headerShown: true, title: t.modules.byId['baby-log'].label }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: tokens.bg }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 24 },
        ]}
      >
        <Text style={[styles.group, { color: tokens.muted }]}>
          {group.name}
        </Text>

        {children === undefined ? null : children.length === 0 ? (
          <Text style={[styles.empty, { color: tokens.muted }]}>
            {t.baby.log.list.emptyBody}
          </Text>
        ) : (
          <View
            style={[
              styles.card,
              { backgroundColor: tokens.surface, borderColor: tokens.border },
            ]}
          >
            {children.map((child) => (
              <Pressable
                key={child._id}
                accessibilityRole="button"
                onPress={() =>
                  router.push({
                    pathname: '/settings/baby-log/[childId]',
                    params: { childId: child._id },
                  })
                }
                style={({ pressed }) => [
                  styles.row,
                  { borderBottomColor: tokens.border },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.name, { color: tokens.fg }]}>
                  {child.name}
                </Text>
                <UI_ICONS.ChevronRight
                  size={18}
                  color={tokens.muted}
                  strokeWidth={2.2}
                />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  group: { fontSize: 13 },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.card,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  name: { flex: 1, fontSize: 16 },
  empty: { fontSize: 15, paddingVertical: 20 },
  pressed: { opacity: 0.6 },
})
