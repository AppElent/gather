import type { ReactNode } from 'react'
import type { WidgetInstance } from '../../lib/modules'

const sizeClasses = {
  compact: 'md:col-span-1',
  standard: 'md:col-span-2',
  wide: 'md:col-span-full',
} as const

export function WidgetFrame({
  instance,
  label,
  children,
  editMode = false,
  onRemove,
}: {
  instance: WidgetInstance
  label: string
  children: ReactNode
  editMode?: boolean
  onRemove?: (instanceId: string) => void
}) {
  return (
    <section
      className={`widget-${instance.size} ${sizeClasses[instance.size]} grid min-w-0 gap-3 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-4`}
      data-widget-instance={instance.instanceId}
    >
      <header className="flex items-center gap-2">
        <h2 className="m-0 text-base font-semibold">{label}</h2>
        {editMode && onRemove ? (
          <button
            type="button"
            className="ml-auto"
            aria-label={`Remove ${label}`}
            onClick={() => onRemove(instance.instanceId)}
          >
            Remove
          </button>
        ) : null}
      </header>
      {children}
    </section>
  )
}
