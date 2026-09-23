import {
  type TastingAttributeValue,
  type TastingFieldDef,
  tastingVocabulary,
} from '@gather/core/tastings'
import { useMessages } from '../../lib/i18n'

export interface TastingFieldRendererProps {
  field: TastingFieldDef
  value: TastingAttributeValue | undefined
  onChange: (value: TastingAttributeValue | undefined) => void
}

export function TastingFieldRenderer({
  field,
  value,
  onChange,
}: TastingFieldRendererProps) {
  const { tastings } = useMessages()
  const label = tastings.fields[field.key as keyof typeof tastings.fields]
  const id = `tasting-field-${field.key}`
  const controlClass =
    'min-h-10 w-full rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-sm'

  const term = (key: string) => {
    if (!field.vocabulary) return key
    const words = tastings.vocabularies[field.vocabulary] as Record<
      string,
      string
    >
    return words[key] ?? key
  }

  return (
    <label htmlFor={id} className="grid gap-1.5 text-sm font-medium">
      <span>{label}</span>
      {field.type === 'text' ? (
        <textarea
          id={id}
          className={`${controlClass} min-h-20 py-2`}
          value={typeof value === 'string' ? value : ''}
          placeholder={
            field.key === 'notes' ? tastings.composer.notesPlaceholder : ''
          }
          onChange={(event) => onChange(event.target.value || undefined)}
        />
      ) : null}
      {field.type === 'number' ? (
        <div className="flex items-center gap-2">
          <input
            id={id}
            className={controlClass}
            type="number"
            min={field.min}
            max={field.max}
            value={typeof value === 'number' ? value : ''}
            onChange={(event) =>
              onChange(
                event.target.value === ''
                  ? undefined
                  : Number(event.target.value),
              )
            }
          />
          {field.unit ? (
            <span className="text-sm text-[var(--app-muted)]">
              {tastings.units[field.unit]}
            </span>
          ) : null}
        </div>
      ) : null}
      {field.type === 'scale' ? (
        <div className="flex items-center gap-3">
          <input
            id={id}
            className="w-full accent-[var(--app-accent)]"
            type="range"
            min={1}
            max={5}
            step={1}
            value={typeof value === 'number' ? value : 3}
            onChange={(event) => onChange(Number(event.target.value))}
          />
          <output htmlFor={id} className="w-4 text-sm font-semibold">
            {typeof value === 'number' ? value : 3}
          </output>
        </div>
      ) : null}
      {field.type === 'select' && field.vocabulary ? (
        <select
          id={id}
          className={controlClass}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value || undefined)}
        >
          <option value="">{tastings.composer.none}</option>
          {tastingVocabulary(field.vocabulary).map((key) => (
            <option key={key} value={key}>
              {term(key)}
            </option>
          ))}
        </select>
      ) : null}
      {field.type === 'tags' ? (
        <>
          <input
            id={id}
            aria-label={label}
            className={controlClass}
            type="text"
            list={field.vocabulary ? `${id}-suggestions` : undefined}
            value={Array.isArray(value) ? value.join(', ') : ''}
            onChange={(event) => {
              const entries = event.target.value
                .split(',')
                .map((entry) => entry.trim())
                .filter(Boolean)
              onChange(entries.length > 0 ? entries : undefined)
            }}
          />
          {field.vocabulary ? (
            <datalist id={`${id}-suggestions`}>
              {tastingVocabulary(field.vocabulary).map((key) => (
                <option key={key} value={key}>
                  {term(key)}
                </option>
              ))}
            </datalist>
          ) : null}
        </>
      ) : null}
    </label>
  )
}
