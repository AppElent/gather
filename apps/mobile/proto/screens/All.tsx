/**
 * PROTOTYPE (#146) — All: the whole catalogue, shelved by Module group, with
 * the pin control on each row. This is where pinning happens, as on the web
 * ("Every module in this group. Pin the ones you use.").
 */
import { router, Stack } from 'expo-router'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { GROUP_LABELS, MODULE_GROUPS, MODULES } from '../catalog'
import { moduleHref, useProto } from '../state'
import { useTokens } from '../tokens'
import { CatalogRow, SectionTitle, useVariant } from '../ui'

export default function All({ header = true }: { header?: boolean }) {
  const t = useTokens()
  const variant = useVariant()
  const { isPinned, togglePin } = useProto()

  return (
    <>
      {header ? <Stack.Screen options={{ title: 'All' }} /> : null}
      <ScrollView
        style={{ backgroundColor: t.bg }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
      >
        <Text style={[styles.lede, { color: t.muted }]}>
          Every Module in this Group. Pin the ones you use.
        </Text>
        {MODULE_GROUPS.map((group) => (
          <View key={group}>
            <SectionTitle>{GROUP_LABELS[group]}</SectionTitle>
            {MODULES.filter((m) => m.group === group).map((module) => (
              <CatalogRow
                key={module.id}
                module={module}
                pinned={isPinned(module.id)}
                onOpen={() =>
                  router.push(moduleHref(variant, module.id, 'all') as never)
                }
                onTogglePin={() => togglePin(module.id)}
              />
            ))}
          </View>
        ))}
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 32, paddingTop: 8 },
  lede: { fontSize: 13, lineHeight: 19 },
})
