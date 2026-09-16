/**
 * The month, Monday first, as a grid of days you can press.
 *
 * It exists because two places now draw one: the Tasks module's `DueDateSheet`,
 * which is where it was designed, and the Calendar prototype's composer, whose
 * build brief says in as many words that *a reimplementation of that grid is a
 * bug, not a variation*. So the drawing moved here and both call it — the
 * arithmetic already lived apart, in `modules/tasks/taskDates.ts`, for the same
 * reason.
 *
 * It knows nothing about what a day *means*. Selection, today, and the tint are
 * props; the caller owns the state and the write. That is what lets one grid
 * serve a sheet that sets a due date and a card that sets an event's day.
 *
 * ## The trailing row
 *
 * `monthGrid` always returns six rows, so a sheet does not jump as you page
 * through it. On a full screen that same rule is 52 points of nothing whenever
 * a month happens to fit in five. `dropTrailingEmptyRow` is that difference,
 * and it is a prop rather than a heuristic because only the caller knows
 * whether its container is fixed.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { MonthGrid } from '../modules/tasks/taskDates'
import { parseDay } from '../modules/tasks/taskDates'
import { useTokens } from '../theme/tokens'

export interface MonthGridViewProps {
  grid: MonthGrid
  /** The app's locale, never the device's (ADR-0011). */
  locale: string
  /** `YYYY-MM-DD`, or undefined where nothing is chosen yet. */
  selected?: string
  /** `YYYY-MM-DD` for the phone's own today, drawn as a ring. */
  today: string
  tint: string
  onPick: (iso: string) => void
  /** Prefix for `testID`s, so two grids on one screen stay addressable. */
  testIDPrefix: string
  /** See the note above: a screen drops it, a sheet does not. */
  dropTrailingEmptyRow?: boolean
}

/**
 * Monday-first narrow weekday names, in the app's language.
 *
 * 1 January 2024 was a Monday, which is the whole reason for the magic date:
 * it makes the strip start where the grid does without anybody having to
 * rotate an array.
 */
export function weekdayNames(locale: string): string[] {
  return Array.from({ length: 7 }, (_, index) =>
    new Date(2024, 0, 1 + index).toLocaleDateString(locale, {
      weekday: 'narrow',
    }),
  )
}

export function WeekdayStrip({ locale }: { locale: string }) {
  const tokens = useTokens()
  return (
    <View style={styles.weekdays}>
      {weekdayNames(locale).map((name, index) => (
        <Text
          // Narrow weekday names repeat (T, T / S, S), so the index is the key.
          key={index}
          style={[styles.weekday, { color: tokens.muted }]}
        >
          {name.toUpperCase()}
        </Text>
      ))}
    </View>
  )
}

export function MonthGridView({
  grid,
  locale,
  selected,
  today,
  tint,
  onPick,
  testIDPrefix,
  dropTrailingEmptyRow = false,
}: MonthGridViewProps) {
  const tokens = useTokens()
  const weeks =
    dropTrailingEmptyRow && grid.weeks[5]?.every((day) => day === null)
      ? grid.weeks.slice(0, 5)
      : grid.weeks

  return (
    <>
      {weeks.map((week, index) => (
        <View key={index} style={styles.week}>
          {week.map((iso, column) =>
            iso === null ? (
              <View key={column} style={styles.day} />
            ) : (
              <Pressable
                key={column}
                testID={`${testIDPrefix}-${iso}`}
                accessibilityRole="button"
                accessibilityState={{ selected: iso === selected }}
                accessibilityLabel={parseDay(iso).toLocaleDateString(locale, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
                onPress={() => onPick(iso)}
                style={styles.day}
              >
                <View
                  style={[
                    styles.dayInner,
                    iso === selected && { backgroundColor: tint },
                    iso === today &&
                      iso !== selected && {
                        borderWidth: 1.4,
                        borderColor: tint,
                      },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      {
                        color:
                          iso === selected
                            ? tokens.surface
                            : iso === today
                              ? tint
                              : tokens.fg,
                        fontWeight:
                          iso === selected || iso === today ? '700' : '400',
                      },
                    ]}
                  >
                    {parseDay(iso).getDate()}
                  </Text>
                </View>
              </Pressable>
            ),
          )}
        </View>
      ))}
    </>
  )
}

const styles = StyleSheet.create({
  weekdays: { flexDirection: 'row', paddingBottom: 4 },
  weekday: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700' },
  week: { flexDirection: 'row' },
  day: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  dayInner: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: { fontSize: 15 },
})
