import type { CalendarPeopleFilter } from '@gather/core/calendar'
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native'
import { NativeSheet } from '../../components/NativeSheet'
import { useI18n } from '../../i18n'
import { RADIUS, useTokens } from '../../theme/tokens'

export function CalendarFilters({
  calendars,
  hiddenCalendarIds,
  people,
  peopleFilter,
  mode,
  onCalendar,
  onPeople,
  onClose,
}: {
  calendars: { id: string; name: string }[]
  hiddenCalendarIds: readonly string[]
  people: { id: string; name: string }[]
  peopleFilter: CalendarPeopleFilter | null
  mode: 'calendars' | 'people'
  onCalendar: (id: string, visible: boolean) => void
  onPeople: (filter: CalendarPeopleFilter | null) => void
  onClose: () => void
}) {
  const { t } = useI18n()
  const tokens = useTokens('home')
  const hidden = new Set(hiddenCalendarIds)
  const selectedPeople = new Set(peopleFilter?.userIds ?? [])
  return (
    <NativeSheet
      title={mode === 'calendars' ? t.calendar.calendars : t.calendar.people}
      onClose={onClose}
      maxHeight={0.7}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {mode === 'calendars' ? (
          calendars.map((calendar) => {
            const visible = !hidden.has(calendar.id)
            return (
              <Pressable
                key={calendar.id}
                onPress={() => onCalendar(calendar.id, !visible)}
                style={[styles.row, { borderColor: tokens.border }]}
                accessibilityRole="button"
                accessibilityState={{ selected: visible }}
              >
                <Text style={[styles.name, { color: tokens.fg }]}>
                  {calendar.name}
                </Text>
                <Text
                  style={[
                    styles.check,
                    { color: visible ? tokens.accent : tokens.muted },
                  ]}
                >
                  {visible ? '✓' : '○'}
                </Text>
              </Pressable>
            )
          })
        ) : (
          <>
            <Pressable
              onPress={() => onPeople(null)}
              style={[styles.row, { borderColor: tokens.border }]}
              accessibilityRole="button"
              accessibilityState={{ selected: peopleFilter === null }}
            >
              <Text style={[styles.name, { color: tokens.fg }]}>
                {t.calendar.everyone}
              </Text>
              <Text
                style={[
                  styles.check,
                  {
                    color: peopleFilter === null ? tokens.accent : tokens.muted,
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
                  style={[styles.row, { borderColor: tokens.border }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.name, { color: tokens.fg }]}>
                    {person.name}
                  </Text>
                  <Text
                    style={[
                      styles.check,
                      { color: selected ? tokens.accent : tokens.muted },
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
              style={[styles.row, { borderColor: tokens.border }]}
              accessibilityRole="button"
              accessibilityState={{
                selected: peopleFilter?.includeUnassigned ?? false,
              }}
            >
              <Text style={[styles.name, { color: tokens.fg }]}>
                {t.calendar.unassigned}
              </Text>
              <Text
                style={[
                  styles.check,
                  {
                    color: peopleFilter?.includeUnassigned
                      ? tokens.accent
                      : tokens.muted,
                  },
                ]}
              >
                {peopleFilter?.includeUnassigned ? '✓' : '○'}
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </NativeSheet>
  )
}

const styles = StyleSheet.create({
  content: { gap: 8 },
  row: {
    minHeight: 52,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.control,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: { flex: 1, fontSize: 16 },
  check: { fontSize: 22 },
})
