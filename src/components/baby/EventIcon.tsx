import { Icon } from '../app/Icon'
import { EVENT_TYPE_ICONS } from './babyEventFields'

/** Lucide glyph for a baby event type, falling back to a plain circle. */
export function EventIcon({
  type,
  className = 'h-4 w-4',
}: {
  type: string
  className?: string
}) {
  return (
    <Icon name={EVENT_TYPE_ICONS[type] ?? 'Circle'} className={className} />
  )
}
