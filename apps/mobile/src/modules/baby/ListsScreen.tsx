/**
 * One of a Child's two checklists — things to do, or questions for the next
 * appointment.
 *
 * **One list per screen.** They are different modes of use ("what I must do"
 * and "what I must ask"), and the card on the log offers them as two rows, so
 * two rows that arrive at the same stacked pair reads as a link that ignored
 * which one you pressed. Each is now its own destination, titled with the list
 * you asked for, and scanning a doctor's appointment for the two lines that
 * belong in it is no longer a thing anybody has to do.
 *
 * It is one route with a `list` param rather than two route files, because the
 * screen is genuinely the same screen with a different subject — the way a
 * detail page is. Two files would be two copies to keep in step.
 *
 * Both are ordinary `taskLists`, so whether they can be written to is the
 * provider's answer and not this screen's (ADR-0021).
 *
 * A Child seeded or created before those fields existed has neither, and used
 * to see an empty screen with no way off it. Arriving here is need enough, so
 * the screen asks the server to fill them in once and then renders normally.
 */
import { useMutation, useQuery } from 'convex/react'
import { Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useRef } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { fmt, useI18n } from '../../i18n'
import { useTokens } from '../../theme/tokens'
import { Checklist } from './Checklist'
import { useBabyLog } from './useBabyLog'

export function ListsScreen() {
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const { t } = useI18n()
  const log = useBabyLog()
  const lists = useQuery(api.taskLists.list, { groupSlug: log.groupSlug })
  const ensureLists = useMutation(api.babies.ensureAuxLists)

  // Anything but `questions` is the to-do list, so a link that lost its param
  // lands somewhere real rather than on a blank screen.
  const { list } = useLocalSearchParams<{ list?: string }>()
  const questions = list === 'questions'

  const text = t.baby.log.lists
  const child = log.child

  // Once per mounted Child. The mutation is idempotent, but the effect would
  // otherwise re-fire on every render between the call and the query catching
  // up, and each of those is a round trip.
  const asked = useRef<string | null>(null)
  const missing = Boolean(
    child && (!child.taskListId || !child.questionsListId),
  )
  const childId = child?._id
  const groupSlug = log.groupSlug
  useEffect(() => {
    if (!childId || !missing || asked.current === childId) return
    asked.current = childId
    ensureLists({ id: childId as Id<'babies'>, groupSlug }).catch(() => {
      // Left for the next visit rather than retried in a loop: the screen
      // still renders, and a list nobody could create is not a crash.
      asked.current = null
    })
  }, [childId, missing, groupSlug, ensureLists])

  const listId = questions ? child?.questionsListId : child?.taskListId
  const found = lists?.find((each) => each._id === listId)
  const title = questions ? text.questions : text.todos

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: tokens.bg }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {listId ? (
          <Checklist
            listId={listId as Id<'taskLists'>}
            groupSlug={log.groupSlug}
            title={title}
            addLabel={questions ? text.addQuestion : text.addTodo}
            writable={found ? found.writable : true}
            readOnlyReason={
              found
                ? fmt(text.readOnlyBody, { provider: found.provider })
                : undefined
            }
          />
        ) : (
          <View style={styles.empty}>
            <Text style={{ color: tokens.muted }}>
              {t.baby.log.child.checklistEmpty}
            </Text>
          </View>
        )}
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 14, gap: 14 },
  empty: { alignItems: 'center', paddingVertical: 40 },
})
