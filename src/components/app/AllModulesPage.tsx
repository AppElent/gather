import type { ModuleDef } from '@gather/core/modules'
import { MODULE_GROUPS, modulesByGroup, moduleText } from '@gather/core/modules'
import {
  movePin,
  pinnedModuleIds,
  pinnedModules,
  togglePin,
} from '@gather/core/pins'
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { NavMessages } from '../../lib/appNavigation'
import { fmt, useMessages } from '../../lib/i18n'
import { moduleLink } from '../../lib/links'
import { Icon } from './Icon'
import { Pill, SurfaceCard } from './ShellPrimitives'
import { useRequiredCurrentGroup } from './useCurrentGroup'

/**
 * Every Module in this Group, pinned or not.
 *
 * This is what makes a large Module count tolerable without any Group ever
 * enabling or disabling one: everything is here, always, and Pins only decide
 * what you personally see first. It is a page rather than a sidebar section so
 * that the desktop sidebar and the mobile dock can end in the same place.
 */
function ModuleFace({
  module,
  messages,
}: {
  module: ModuleDef
  messages: NavMessages
}) {
  return (
    <Link
      {...moduleLink(module)}
      className="grid min-w-0 grid-cols-[28px_minmax(0,1fr)] items-center gap-2 text-sm font-semibold text-[var(--app-fg)] no-underline"
    >
      <span className="grid h-7 w-7 place-items-center rounded-[7px] border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-muted)]">
        <Icon name={module.icon} className="h-4 w-4" />
      </span>
      <span className="truncate">{moduleText(module, messages).label}</span>
    </Link>
  )
}

const ROW =
  'flex flex-wrap items-center justify-between gap-2 border-t border-[var(--app-border)] py-2 first:border-t-0 first:pt-0'

const BUTTON =
  'inline-flex min-h-8 items-center justify-center rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] px-2 text-xs font-semibold text-[var(--app-fg)] disabled:opacity-40'

export function AllModulesPage() {
  const { slug: groupSlug } = useRequiredCurrentGroup()
  const messages = useMessages()
  const { allModules, marks } = messages.shell
  const { loading } = messages.common.errors
  // This Group's pins, not the reader's everywhere-pins (ADR-0005) — the page
  // is inside a Group and every pin it shows or writes is about that one.
  const pins = useQuery(api.users.myPins, { groupSlug })
  const savePins = useMutation(api.users.setPins)

  // Until the answer arrives, showing the default would be showing somebody
  // else's pins — an empty list and disabled buttons is the honest state.
  const loaded = pins !== undefined
  const ids = loaded ? pinnedModuleIds(pins ?? undefined) : []
  const pinned = loaded ? pinnedModules(pins ?? undefined) : []
  const byGroup = modulesByGroup()

  // What a screen reader says after a move: the arrow keeps focus, so
  // nothing else tells it the module went anywhere.
  const [announcement, setAnnouncement] = useState('')
  // The arrow to focus once a move lands a pin at an end, where the one just
  // pressed turns disabled and would drop focus to the page. The pins come
  // back from Convex, so this waits for the pressed arrow to turn disabled.
  const [focusNext, setFocusNext] = useState<string | null>(null)
  const order = ids.join(',')
  useEffect(() => {
    if (!focusNext || !order) return
    const [id, direction] = focusNext.split(':')
    const pressed = document.querySelector<HTMLButtonElement>(
      `[data-move="${id}:${direction === 'up' ? 'down' : 'up'}"]`,
    )
    if (!pressed?.disabled) return
    document
      .querySelector<HTMLButtonElement>(`[data-move="${focusNext}"]`)
      ?.focus()
    setFocusNext(null)
  }, [focusNext, order])

  const write = (next: string[]) => {
    setAnnouncement('')
    void savePins({ groupSlug, moduleIds: next })
  }

  const move = (module: ModuleDef, direction: 'up' | 'down') => {
    const next = movePin(ids, module.id, direction)
    const at = next.indexOf(module.id)
    if (direction === 'up' && at === 0) setFocusNext(`${module.id}:down`)
    if (direction === 'down' && at === next.length - 1) {
      setFocusNext(`${module.id}:up`)
    }
    setAnnouncement(
      fmt(allModules.moved, {
        module: moduleText(module, messages).label,
        position: at + 1,
        total: next.length,
      }),
    )
    savePins({ groupSlug, moduleIds: next }).catch(() => setAnnouncement(''))
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-4">
      <header>
        <h1 className="m-0 text-2xl font-semibold">{allModules.title}</h1>
        <p className="mt-1 mb-0 text-sm leading-6 text-[var(--app-muted)]">
          {allModules.intro}
        </p>
      </header>

      <SurfaceCard ariaLabel={allModules.yourPins}>
        <h2 className="m-0 mb-2 text-sm font-semibold">
          {allModules.yourPins}
        </h2>
        <p role="status" aria-live="polite" className="sr-only">
          {announcement}
        </p>
        {pinned.length === 0 ? (
          <p className="m-0 text-sm text-[var(--app-muted)]">
            {loaded ? allModules.nothingPinned : loading}
          </p>
        ) : (
          <div className="grid">
            {pinned.map((module, index) => (
              <div key={module.id} className={ROW}>
                <div className="flex min-w-0 items-center gap-2">
                  <ModuleFace module={module} messages={messages} />
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    className={BUTTON}
                    disabled={index === 0}
                    data-move={`${module.id}:up`}
                    aria-label={fmt(allModules.moveUp, {
                      module: moduleText(module, messages).label,
                    })}
                    onClick={() => move(module, 'up')}
                  >
                    <ArrowUp className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={BUTTON}
                    disabled={index === pinned.length - 1}
                    data-move={`${module.id}:down`}
                    aria-label={fmt(allModules.moveDown, {
                      module: moduleText(module, messages).label,
                    })}
                    onClick={() => move(module, 'down')}
                  >
                    <ArrowDown className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={BUTTON}
                    aria-label={fmt(allModules.unpinModule, {
                      module: moduleText(module, messages).label,
                    })}
                    onClick={() => write(togglePin(ids, module.id))}
                  >
                    {allModules.unpin}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SurfaceCard>

      {MODULE_GROUPS.map((group) => {
        const heading = messages.modules.groups[group]
        return (
          <SurfaceCard key={group} ariaLabel={heading}>
            <h2 className="m-0 mb-2 text-sm font-semibold">{heading}</h2>
            <div className="grid">
              {byGroup[group].map((module) => {
                const isOn = ids.includes(module.id)
                const name = moduleText(module, messages).label
                return (
                  <div key={module.id} className={ROW}>
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <ModuleFace module={module} messages={messages} />
                      {module.status === 'placeholder' ? (
                        <Pill>{marks.soon}</Pill>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className={BUTTON}
                      disabled={!loaded}
                      aria-label={fmt(
                        isOn ? allModules.unpinModule : allModules.pinModule,
                        { module: name },
                      )}
                      onClick={() => write(togglePin(ids, module.id))}
                    >
                      {isOn ? allModules.unpin : allModules.pin}
                    </button>
                  </div>
                )
              })}
            </div>
          </SurfaceCard>
        )
      })}
    </div>
  )
}
