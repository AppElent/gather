import type { LucideIcon } from 'lucide-react'
import * as Icons from 'lucide-react'
import { EVENT_TYPE_ICONS } from '../../lib/babyEventFields'

/** Lucide glyph for a baby event type, falling back to a plain circle. */
export function EventIcon({
  type,
  className = 'h-4 w-4',
}: {
  type: string
  className?: string
}) {
  const Icon =
    (Icons as unknown as Record<string, LucideIcon>)[
      EVENT_TYPE_ICONS[type] ?? 'Circle'
    ] ?? Icons.Circle
  return <Icon className={className} aria-hidden="true" />
}
