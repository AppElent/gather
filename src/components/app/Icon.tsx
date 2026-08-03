import type { LucideIcon } from 'lucide-react'
import * as Icons from 'lucide-react'

/**
 * A lucide icon looked up by the name a Module declares.
 *
 * The Module registry stores its icon as a plain string, so the lookup is a
 * runtime one and the cast below is unavoidable — but it only has to exist
 * once. Every surface that lists Modules comes here rather than writing its
 * own copy. An unknown name falls back to a square instead of rendering
 * nothing, because a missing icon should not take a navigation item with it.
 */
export function Icon({
  name,
  className,
}: {
  name: string
  className?: string
}) {
  const Component =
    (Icons as unknown as Record<string, LucideIcon>)[name] ?? Icons.Square
  return <Component className={className} aria-hidden="true" />
}
