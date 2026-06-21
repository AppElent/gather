import * as Icons from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export function ModulePlaceholder({
  label,
  description,
  icon,
}: {
  label: string
  description: string
  icon: string
}) {
  const Icon = (Icons as unknown as Record<string, LucideIcon>)[icon] ?? Icons.Square

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-20 text-center">
      <Icon className="h-10 w-10 opacity-60" aria-hidden="true" />
      <h1 className="text-xl font-semibold">{label}</h1>
      <p className="text-sm opacity-70">{description}</p>
      <span className="mt-2 rounded-full border px-3 py-1 text-xs uppercase tracking-wide opacity-60">
        Coming soon
      </span>
    </div>
  )
}
