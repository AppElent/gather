import type { CalendarPeopleFilter } from '@gather/core/calendar'
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native'
import { NativeSheet } from '../../components/NativeSheet'
import { useI18n } from '../../i18n'
import { RADIUS, TYPE, useTokens } from '../../theme/tokens'

export function CalendarFilters({
  people,
  peopleFilter,
  onPeople,
  onClose,
}: {
  people: { id: string; name: string }[]
  peopleFilter: CalendarPeopleFilter | null
  onPeople: (filter: CalendarPeopleFilter | null) => void
  onClose: () => void
}) {
  const { t } = useI18n()
  const tokens = useTokens('home')
  const selectedPeople = new Set(peopleFilter?.userIds ?? [])
  return (
    <NativeSheet
      title={t.calendar.people}
      onClose={onClose}
      maxHeight={0.7}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          onPress={() => onPeople(null)}
          style={[styles.row, { borderColor: tokens.hair }]}
          accessibilityRole="button"
          accessibilityState={{ selected: peopleFilter === null }}
        >
          <Text style={[styles.name, { color: tokens.ink }]}>
            {t.calendar.everyone}
          </Text>
          <Text
            style={[
              styles.check,
              {
                color: peopleFilter === null ? tokens.ink : tokens.muted,
              },
            ]}
          >
            {peopleFilter === null ? '✓' : '○'}
          </Text>
        </Pressable>
        {people.map((person) => {
          const selected = selectedPeople.has(person.id)
          const next = new Set(selectedPeople)
          if (selected) next.delete(person.id)
          else next.add(person.id)
          const filter = {
            userIds: [...next],
            includeUnassigned: peopleFilter?.includeUnassigned ?? false,
          }
          return (
            <Pressable
              key={person.id}
              onPress={() => onPeople(filter)}
              style={[styles.row, { borderColor: tokens.hair }]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.name, { color: tokens.ink }]}>
                {person.name}
              </Text>
              <Text
                style={[
                  styles.check,
                  { color: selected ? tokens.ink : tokens.muted },
                ]}
              >
                {selected ? '✓' : '○'}
              </Text>
            </Pressable>
          )
        })}
        <Pressable
          onPress={() =>
            onPeople({
              userIds: peopleFilter?.userIds ?? [],
              includeUnassigned: !(
                peopleFilter?.includeUnassigned ?? false
              ),
            })
          }
          style={[styles.row, { borderColor: tokens.hair }]}
          accessibilityRole="button"
          accessibilityState={{
            selected: peopleFilter?.includeUnassigned ?? false,
          }}
        >
          <Text style={[styles.name, { color: tokens.ink }]}>
            {t.calendar.unassigned}
          </Text>
          <Text
            style={[
              styles.check,
              {
                color: peopleFilter?.includeUnassigned
                  ? tokens.ink
                  : tokens.muted,
              },
            ]}
          >
            {peopleFilter?.includeUnassigned ? '✓' : '○'}
          </Text>
        </Pressable>
      </ScrollView>
    </NativeSheet>
  )
}

const styles = StyleSheet.create({
  content: { gap: 8 },
  row: {
    minHeight: 52,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.card,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: { ...TYPE.body, flex: 1 },
  check: { ...TYPE.title2 },
})
