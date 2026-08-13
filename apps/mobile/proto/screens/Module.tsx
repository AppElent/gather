/**
 * PROTOTYPE (#146) — a Module placeholder, the shape of the web's
 * `ModulePlaceholder`. Wears its group's tint (ADR-0017): the catalogue is the
 * identity, so a placeholder is not a blank page.
 *
 * Says nothing about which Group it belongs to: ADR-0007's noticeability is
 * repaid at the point of *write*, and a read-only screen stays quiet (#145).
 */
import { router, Stack, useLocalSearchParams, useNavigation } from 'expo-router'
import { useEffect, useRef } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { moduleById } from '../catalog'
import { switchGroupHref, useProto } from '../state'
import { RADIUS, useTokens } from '../tokens'
import { Icon, useVariant } from '../ui'

export default function Module({
  id: fixedId,
  chrome = true,
}: {
  id?: string
  /** False when this Module *is* a tab: there is no stack above it to title. */
  chrome?: boolean
}) {
  const params = useLocalSearchParams<{ id?: string }>()
  useResetOnGroupSwitch()
  const insets = useSafeAreaInsets()
  const variant = useVariant()
  const { groupChrome, groupName } = useProto()
  const id = fixedId ?? params.id ?? ''
  const module = moduleById(id)
  const t = useTokens(module?.group)
  const drawnHeader = groupChrome === 'strip'

  if (!module) {
    return (
      <View style={[styles.center, { backgroundColor: t.bg }]}>
        <Text style={{ color: t.fg }}>No Module “{id}”.</Text>
      </View>
    )
  }

  const tint = t.tintOf(module.group)

  return (
    <>
      {chrome ? (
        <Stack.Screen
          options={{ title: module.label, headerShown: !drawnHeader }}
        />
      ) : null}

      {/* Option 3: a Group line above a header we now have to draw ourselves,
          because the native one has no slot for ambient context. */}
      {drawnHeader ? (
        <View
          style={[
            styles.drawnHeader,
            {
              paddingTop: insets.top + 6,
              backgroundColor: t.surface,
              borderBottomColor: t.border,
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Group: ${groupName}. Switch Group`}
            onPress={() => router.push(switchGroupHref(variant) as never)}
            style={styles.drawnGroupRow}
            hitSlop={6}
          >
            <Text style={[styles.drawnGroup, { color: t.muted }]}>
              {groupName}
            </Text>
            <Icon name="expand-more" size={16} color={t.muted} />
          </Pressable>
          <View style={styles.drawnTitleRow}>
            {chrome ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back"
                onPress={() => router.back()}
                hitSlop={8}
              >
                <Icon name="arrow-back" size={24} color={t.fg} />
              </Pressable>
            ) : null}
            <Text style={[styles.drawnTitle, { color: t.fg }]}>
              {module.label}
            </Text>
          </View>
        </View>
      ) : null}

      <ScrollView
        style={{ backgroundColor: t.bg }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.content,
          chrome && !drawnHeader ? null : { paddingTop: 16 },
          !chrome && !drawnHeader ? { paddingTop: insets.top + 16 } : null,
        ]}
      >
        <View style={[styles.hero, { backgroundColor: tint.bg }]}>
          <Icon name={module.icon} size={40} color={tint.fg} />
          <Text style={[styles.title, { color: t.fg }]}>{module.label}</Text>
          <Text style={[styles.description, { color: t.fg }]}>
            {module.description}
          </Text>
          <View style={[styles.badge, { backgroundColor: tint.fg }]}>
            <Text style={[styles.badgeText, { color: t.surface }]}>
              {module.status === 'live' ? 'On the web' : 'Coming soon'}
            </Text>
          </View>
        </View>
        <Text style={[styles.note, { color: t.muted }]}>
          {module.scope === 'personal'
            ? 'Personal — this is about you and reads the same from every Group.'
            : // Option 2: the Group named in the body, where it costs no chrome.
              groupChrome === 'content'
              ? `Shared with everyone in ${groupName}.`
              : 'Shared with everyone in this Group.'}
        </Text>
      </ScrollView>
    </>
  )
}

/**
 * A Group switch resets every tab to its root (#145 §5). A pushed screen is
 * still mounted in an unfocused tab, so it unwinds its own stack the moment
 * the Group changes — which is how the *other* tabs get reset without the tab
 * navigator itself being touched.
 */
function useResetOnGroupSwitch() {
  const navigation = useNavigation()
  const { groupEpoch } = useProto()
  const seen = useRef(groupEpoch)

  useEffect(() => {
    if (seen.current === groupEpoch) return
    seen.current = groupEpoch
    const stack = navigation as unknown as { popToTop?: () => void }
    stack.popToTop?.()
  }, [groupEpoch, navigation])
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { borderRadius: RADIUS.card, padding: 20, gap: 10 },
  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.4 },
  description: { fontSize: 15, lineHeight: 21 },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  note: { fontSize: 13, lineHeight: 19 },
  drawnHeader: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  drawnGroupRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  drawnGroup: { fontSize: 12, fontWeight: '600' },
  drawnTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  drawnTitle: { fontSize: 20, fontWeight: '700' },
})
