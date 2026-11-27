import type { ModuleGroup } from '@gather/core/modules'
import { Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import type { AppLink } from '../../lib/links'
import { buttonClass } from './buttons'
import { ModuleTile } from './ModuleTile'

/**
 * The phone's three empty states (web-shell_final.md, "Empty states"):
 *
 * - `nothing-yet`: the collection is empty. One add button in the group fill.
 * - `nothing-found`: a search or filter matched nothing. A way to clear it.
 * - `nothing-for-you`: there is nothing here for this person to do. No action.
 */
export type EmptyStateKind = 'nothing-yet' | 'nothing-found' | 'nothing-for-you'

interface EmptyAction {
  label: string
  link?: AppLink
  onClick?: () => void
}

export function EmptyState({
  kind,
  title,
  body,
  action,
  tile,
}: {
  kind: EmptyStateKind
  title: string
  body?: ReactNode
  /** Ignored for `nothing-for-you`, which offers nothing to do. */
  action?: EmptyAction
  /** The Module's tile above the title on `nothing-yet`. */
  tile?: { group: ModuleGroup; icon: string }
}) {
  const shown = kind === 'nothing-for-you' ? undefined : action
  const className =
    kind === 'nothing-yet' ? buttonClass.primary : buttonClass.secondary
  const content = (
    <>
      {kind === 'nothing-yet' ? (
        <Plus className="size-[18px]" strokeWidth={2.4} aria-hidden="true" />
      ) : null}
      {shown?.label}
    </>
  )

  return (
    <section
      data-empty={kind}
      className="grid justify-items-center gap-3 rounded-[var(--radius-card)] bg-[var(--surface)] px-6 py-10 text-center"
    >
      {tile && kind === 'nothing-yet' ? (
        <ModuleTile group={tile.group} icon={tile.icon} size="m" />
      ) : null}
      <h2 className="m-0 font-rounded text-title-2 font-bold">{title}</h2>
      {body ? (
        <p className="m-0 max-w-[36ch] text-subhead text-[var(--muted)]">
          {body}
        </p>
      ) : null}
      {shown ? (
        shown.link ? (
          <Link {...shown.link} className={className}>
            {content}
          </Link>
        ) : (
          <button type="button" onClick={shown.onClick} className={className}>
            {content}
          </button>
        )
      ) : null}
    </section>
  )
}
