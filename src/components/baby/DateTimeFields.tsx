import { todayIn } from '@gather/core/civil-date'
import { combineDateTime, toTimeInputValue } from './babyDate'
import { BABY_INPUT_CLASS } from './babyEventFields'

interface DateTimeFieldsProps {
  label: string
  /** Epoch ms, or undefined for a moment not set yet (both inputs empty). */
  valueMs: number | undefined
  /** Supplies the half not typed yet while `valueMs` is unset. */
  fallbackMs?: number
  /** The Group's IANA time zone when set; absent uses this device's calendar. */
  timeZone?: string
  /** Undefined when the date is cleared. */
  onChange: (ms: number | undefined) => void
  required?: boolean
}

/**
 * One moment as a date input and a time input side by side, in `timeZone` or
 * local time.
 *
 * Two inputs rather than `datetime-local`, which renders unpredictably wide on
 * mobile Safari and overflows its card. The time waits for a date: on its own
 * it names no moment.
 */
export function DateTimeFields({
  label,
  valueMs,
  fallbackMs,
  timeZone,
  onChange,
  required,
}: DateTimeFieldsProps) {
  const baseMs = valueMs ?? fallbackMs ?? Date.now()
  return (
    <div className="min-w-0">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <div className="flex gap-2">
        <input
          type="date"
          className={BABY_INPUT_CLASS}
          value={valueMs === undefined ? '' : todayIn(timeZone, valueMs)}
          onChange={(e) =>
            onChange(
              e.target.value
                ? combineDateTime(
                    e.target.value,
                    toTimeInputValue(baseMs, timeZone),
                    timeZone,
                  )
                : undefined,
            )
          }
          required={required}
        />
        <input
          type="time"
          className={BABY_INPUT_CLASS}
          value={valueMs === undefined ? '' : toTimeInputValue(valueMs, timeZone)}
          onChange={(e) =>
            onChange(
              combineDateTime(
                todayIn(timeZone, baseMs),
                e.target.value,
                timeZone,
              ),
            )
          }
          disabled={valueMs === undefined}
          required={required}
        />
      </div>
    </div>
  )
}
