import type { CalendarEvent } from '@gather/core/calendar'
import { useMutation } from 'convex/react'
import { useState } from 'react'
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { api } from '../../../../../convex/_generated/api'
import { useAvailability } from '../../availability/AvailabilityProvider'
import { NativeSheet } from '../../components/NativeSheet'
import { useI18n } from '../../i18n'
import { RADIUS, useTokens } from '../../theme/tokens'

export function CalendarManagementSheet({
  groupSlug,
  calendars,
  hiddenCalendarIds,
  onVisibility,
  onCreated,
  onClose,
}: {
  groupSlug: string
  calendars: { id: string; name: string; color?: CalendarEvent['color'] }[]
  hiddenCalendarIds: readonly string[]
  onVisibility: (id: string, visible: boolean) => void
  onCreated?: (id: string) => void
  onClose: () => void
}) {
  const { t } = useI18n()
  const tokens = useTokens('home')
  const { serviceActionsEnabled } = useAvailability()
  const add = useMutation(api.kitchen.addCalendar)
  const update = useMutation(api.calendar.updateCalendar)
  const remove = useMutation(api.kitchen.removeCalendar)
  const [name, setName] = useState('')
  const colors: CalendarEvent['color'][] = [
    'home',
    'kitchen',
    'money',
    'tasting',
  ]
  return (
    <NativeSheet title={t.calendar.calendars} onClose={onClose} maxHeight={0.8}>
      <ScrollView contentContainerStyle={styles.content}>
        {calendars.map((calendar) => {
          const visible = !hiddenCalendarIds.includes(calendar.id)
          return (
            <View
              key={calendar.id}
              style={[styles.row, { borderColor: tokens.border }]}
            >
              <Pressable
                disabled={!serviceActionsEnabled}
                onPress={() => onVisibility(calendar.id, !visible)}
              >
                <Text style={{ color: visible ? tokens.accent : tokens.muted }}>
                  {visible ? '✓' : '○'}
                </Text>
              </Pressable>
              <View
                style={[
                  styles.swatch,
                  {
                    backgroundColor: tokens.tintOf(calendar.color ?? 'home').fg,
                  },
                ]}
              />
              <Text style={[styles.name, { color: tokens.fg }]}>
                {calendar.name}
              </Text>
              <View style={styles.colorChoices}>
                {colors.map((color) => (
                  <Pressable
                    key={color}
                    accessibilityLabel={color}
                    onPress={() => {
                      if (serviceActionsEnabled)
                        void update({
                          groupSlug,
                          id: calendar.id as never,
                          color,
                        })
                    }}
                    style={[
                      styles.color,
                      { backgroundColor: tokens.tintOf(color).fg },
                      calendar.color === color && styles.chosen,
                    ]}
                  />
                ))}
              </View>
              <Pressable
                disabled={!serviceActionsEnabled}
                onPress={() =>
                  Alert.alert(
                    t.calendar.confirmDelete.replace('{title}', calendar.name),
                    t.calendar.deleteCalendarBody,
                    [
                      { text: t.actions.cancel, style: 'cancel' },
                      {
                        text: t.actions.delete,
                        style: 'destructive',
                        onPress: () =>
                          void remove({ groupSlug, id: calendar.id as never }),
                      },
                    ],
                  )
                }
              >
                <Text style={{ color: tokens.danger }}>×</Text>
              </Pressable>
            </View>
          )
        })}
        <View style={[styles.add, { borderColor: tokens.border }]}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t.calendar.addCalendar}
            placeholderTextColor={tokens.muted}
            style={[styles.input, { color: tokens.fg }]}
          />
          <Pressable
            disabled={!serviceActionsEnabled || !name.trim()}
            onPress={() => {
              void add({ groupSlug, name: name.trim() }).then((id) => {
                onCreated?.(id)
                setName('')
              })
            }}
          >
            <Text style={{ color: tokens.accent }}>
              {t.calendar.addCalendar}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </NativeSheet>
  )
}

const styles = StyleSheet.create({
  content: { gap: 10 },
  row: {
    minHeight: 58,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.control,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  swatch: { width: 10, height: 10, borderRadius: 5 },
  name: { flex: 1, fontSize: 15 },
  colorChoices: { flexDirection: 'row', gap: 4 },
  color: { width: 18, height: 18, borderRadius: 9 },
  chosen: { borderColor: '#000', borderWidth: 2 },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.control,
    paddingHorizontal: 12,
  },
  input: { flex: 1, minHeight: 48, fontSize: 16 },
})
