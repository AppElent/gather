/**
 * PROTOTYPE (#146) — Home.
 *
 * Deliberately *not* the catalogue. The web's Home is the Group's name, who is
 * in it and what has been happening (`src/components/home/GroupHome.tsx`), and
 * that content exists whether or not a Module has been built on the phone. The
 * pins strip is #142's answer to where the Pins live once they cannot be tabs.
 *
 * The Group name is the switcher (#145) and there is no persistent Group line
 * in chrome — this is the one screen that names it.
 */
import { router } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ACTIVITY, moduleById } from '../catalog'
import {
  allHref,
  moduleHref,
  switchGroupHref,
  useProto,
  YOU_HREF,
} from '../state'
import { RADIUS, useTokens } from '../tokens'
import { Card, Icon, PinTile, SectionTitle, useVariant } from '../ui'

export default function Home() {
  const t = useTokens()
  const insets = useSafeAreaInsets()
  const variant = useVariant()
  const { groupName, pins } = useProto()
  const pinned = pins.map(moduleById).filter((m) => m !== undefined)

  return (
    <ScrollView
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + 8,
        paddingHorizontal: 16,
        paddingBottom: 32,
      }}
    >
      <View style={styles.headerRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Group: ${groupName}. Switch Group`}
          onPress={() => router.push(switchGroupHref(variant) as never)}
          style={styles.groupButton}
          hitSlop={6}
        >
          <Text style={[styles.groupName, { color: t.fg }]}>{groupName}</Text>
          <Icon name="expand-more" size={22} color={t.muted} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="You"
          onPress={() => router.push(YOU_HREF as never)}
          style={[styles.avatar, { backgroundColor: t.tile }]}
        >
          <Text style={[styles.avatarText, { color: t.fg }]}>EJ</Text>
        </Pressable>
      </View>

      <SectionTitle>Your pins</SectionTitle>
      {pinned.length === 0 ? (
        <Text style={[styles.empty, { color: t.muted }]}>
          Nothing pinned. Pin the Modules you use from All.
        </Text>
      ) : (
        <View style={styles.pinRow}>
          {pinned.slice(0, 4).map((module) => (
            <PinTile
              key={module.id}
              module={module}
              onPress={() =>
                router.push(moduleHref(variant, module.id, 'home') as never)
              }
            />
          ))}
        </View>
      )}

      {variant === 'f' ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(allHref(variant) as never)}
          style={[
            styles.allButton,
            { backgroundColor: t.surface, borderColor: t.border },
          ]}
        >
          <Icon name="apps" size={20} color={t.fg} />
          <Text style={[styles.allLabel, { color: t.fg }]}>All modules</Text>
          <View style={styles.spacer} />
          <Icon name="chevron-right" size={20} color={t.muted} />
        </Pressable>
      ) : null}

      <SectionTitle>Recent activity</SectionTitle>
      <Card>
        {ACTIVITY.map((entry, index) => (
          <View
            key={entry.id}
            style={[
              styles.activityRow,
              index > 0 && {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: t.border,
              },
            ]}
          >
            <View
              style={[
                styles.activityIcon,
                { backgroundColor: t.tintOf(entry.group).bg },
              ]}
            >
              <Icon
                name={entry.icon}
                size={16}
                color={t.tintOf(entry.group).fg}
              />
            </View>
            <View style={styles.activityText}>
              <Text style={[styles.activityLine, { color: t.fg }]}>
                <Text style={styles.bold}>{entry.who}</Text> {entry.verb}{' '}
                <Text style={styles.bold}>{entry.title}</Text>
              </Text>
              <Text style={[styles.activityMeta, { color: t.muted }]}>
                {entry.module} · {entry.when}
              </Text>
            </View>
          </View>
        ))}
      </Card>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupButton: { flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1 },
  groupName: { fontSize: 24, fontWeight: '700', letterSpacing: -0.4 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 12, fontWeight: '700' },
  pinRow: { flexDirection: 'row', gap: 9 },
  empty: { fontSize: 13, lineHeight: 19 },
  allButton: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: RADIUS.control,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    height: 48,
  },
  allLabel: { fontSize: 14, fontWeight: '600' },
  spacer: { flex: 1 },
  activityRow: { flexDirection: 'row', gap: 10, paddingVertical: 9 },
  activityIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityText: { flex: 1, gap: 2 },
  activityLine: { fontSize: 13, lineHeight: 18 },
  bold: { fontWeight: '700' },
  activityMeta: { fontSize: 11 },
})
