import type { BabyEventType } from '../../../convex/lib/babyEvents'
import {
  combineDateTime,
  toDateInputValue,
  toTimeInputValue,
} from '../../lib/babyDate'
import {
  DIAPER_KINDS,
  FEEDING_METHODS,
  BABY_INPUT_CLASS as inputClass,
  TEMPERATURE_METHODS,
  TEMPERATURE_OPTIONS,
} from '../../lib/babyEventFields'
import type { EventValues } from '../../lib/babyEventFormValues'
import { useMessages } from '../../lib/i18n'

interface EventTypeFieldsProps {
  type: BabyEventType
  values: EventValues
  /** The entry's start time — end date/time inputs default their missing half to it. */
  timestampMs: number
  onChange: (patch: EventValues) => void
}

/** The type-specific half of a baby-log entry form. Fully controlled, so one
 * parent can render several of these at once (MultiEventForm). */
export function EventTypeFields({
  type,
  values,
  timestampMs,
  onChange,
}: EventTypeFieldsProps) {
  const { fields, options: labels } = useMessages().baby.log
  const str = (key: string) =>
    typeof values[key] === 'string' ? (values[key] as string) : ''

  const endMs = str('endTimestamp') ? Number(str('endTimestamp')) : undefined

  function setEndDate(dateStr: string) {
    if (!dateStr) {
      onChange({ endTimestamp: '' })
      return
    }
    const time = toTimeInputValue(endMs ?? timestampMs)
    onChange({ endTimestamp: String(combineDateTime(dateStr, time)) })
  }

  function setEndTime(timeStr: string) {
    const date = toDateInputValue(endMs ?? timestampMs)
    onChange({ endTimestamp: String(combineDateTime(date, timeStr)) })
  }

  const endFields = (
    <div className="min-w-0">
      <span className="mb-1 block text-sm font-medium">{fields.end}</span>
      <div className="flex gap-2">
        <input
          type="date"
          className={inputClass}
          value={endMs ? toDateInputValue(endMs) : ''}
          onChange={(e) => setEndDate(e.target.value)}
        />
        <input
          type="time"
          className={inputClass}
          value={endMs ? toTimeInputValue(endMs) : ''}
          onChange={(e) => setEndTime(e.target.value)}
          disabled={!endMs}
        />
      </div>
    </div>
  )

  switch (type) {
    case 'temperature': {
      const celsius = str('celsius')
      const options = TEMPERATURE_OPTIONS.includes(celsius)
        ? TEMPERATURE_OPTIONS
        : [celsius, ...TEMPERATURE_OPTIONS]
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{fields.temperature}</span>
            <select
              className={inputClass}
              value={celsius}
              onChange={(e) => onChange({ celsius: e.target.value })}
            >
              {options.map((v) => (
                <option key={v} value={v}>
                  {v}°C
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{fields.method}</span>
            <select
              className={inputClass}
              value={str('method')}
              onChange={(e) => onChange({ method: e.target.value })}
            >
              <option value="">{fields.notSpecified}</option>
              {TEMPERATURE_METHODS.map((k) => (
                <option key={k} value={k}>
                  {labels.temperatureMethod[k]}
                </option>
              ))}
            </select>
          </label>
        </div>
      )
    }

    case 'feeding': {
      const method = str('method')
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{fields.method}</span>
            <select
              className={inputClass}
              value={method}
              onChange={(e) => onChange({ method: e.target.value })}
            >
              {FEEDING_METHODS.map((k) => (
                <option key={k} value={k}>
                  {labels.feedingMethod[k]}
                </option>
              ))}
            </select>
          </label>
          {method === 'breast' ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">{fields.leftMin}</span>
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  className={inputClass}
                  value={str('leftMin')}
                  onChange={(e) => onChange({ leftMin: e.target.value })}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">
                  {fields.rightMin}
                </span>
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  className={inputClass}
                  value={str('rightMin')}
                  onChange={(e) => onChange({ rightMin: e.target.value })}
                />
              </label>
            </div>
          ) : (
            <label className="block text-sm">
              <span className="mb-1 block font-medium">{fields.amountMl}</span>
              <input
                type="number"
                inputMode="numeric"
                className={inputClass}
                value={str('amountMl')}
                onChange={(e) => onChange({ amountMl: e.target.value })}
              />
            </label>
          )}
          {/* Breast feeds get their duration from the per-side minutes, so the
              end time is derived rather than asked for. */}
          {method !== 'breast' && endFields}
        </div>
      )
    }

    case 'diaper':
      return (
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{fields.kind}</span>
          <select
            className={inputClass}
            value={str('kind')}
            onChange={(e) => onChange({ kind: e.target.value })}
          >
            {DIAPER_KINDS.map((k) => (
              <option key={k} value={k}>
                {labels.diaperKind[k]}
              </option>
            ))}
          </select>
        </label>
      )

    case 'sleep':
      return <div className="grid gap-3 sm:grid-cols-2">{endFields}</div>

    case 'growth':
      return (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{fields.weightKg}</span>
            <input
              type="number"
              step="0.01"
              inputMode="decimal"
              className={inputClass}
              value={str('weightKg')}
              onChange={(e) => onChange({ weightKg: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{fields.heightCm}</span>
            <input
              type="number"
              step="0.1"
              inputMode="decimal"
              className={inputClass}
              value={str('heightCm')}
              onChange={(e) => onChange({ heightCm: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{fields.headCm}</span>
            <input
              type="number"
              step="0.1"
              inputMode="decimal"
              className={inputClass}
              value={str('headCircumferenceCm')}
              onChange={(e) =>
                onChange({ headCircumferenceCm: e.target.value })
              }
            />
          </label>
        </div>
      )

    case 'medication':
      return (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-sm sm:col-span-1">
            <span className="mb-1 block font-medium">
              {fields.medicationName}
            </span>
            <input
              className={inputClass}
              value={str('name')}
              onChange={(e) => onChange({ name: e.target.value })}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{fields.doseAmount}</span>
            <input
              type="number"
              step="0.01"
              inputMode="decimal"
              className={inputClass}
              value={str('doseAmount')}
              onChange={(e) => onChange({ doseAmount: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{fields.doseUnit}</span>
            <input
              className={inputClass}
              placeholder={fields.doseUnitPlaceholder}
              value={str('doseUnit')}
              onChange={(e) => onChange({ doseUnit: e.target.value })}
            />
          </label>
        </div>
      )

    case 'vaccination':
      return (
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{fields.vaccineName}</span>
          <input
            className={inputClass}
            value={str('name')}
            onChange={(e) => onChange({ name: e.target.value })}
            required
          />
        </label>
      )

    case 'note':
      return (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={values.milestone === true}
            onChange={(e) => onChange({ milestone: e.target.checked })}
          />
          <span className="font-medium">{fields.milestone}</span>
        </label>
      )

    case 'memory':
      return (
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{fields.what}</span>
          <input
            className={inputClass}
            placeholder={fields.whatPlaceholder}
            value={str('what')}
            onChange={(e) => onChange({ what: e.target.value })}
            required
          />
        </label>
      )
  }
}
