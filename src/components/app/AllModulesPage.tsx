import type { ModuleDef } from '@gather/core/modules'
import { MODULE_GROUPS, modulesByGroup, moduleText } from '@gather/core/modules'
import {
  movePin,
  pinnedModuleIds,
  pinnedModules,
  togglePin,
} from '@gather/core/pins'
import { useMutation, useQuery } from 'convex/react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { fmt, useMessages } from '../../lib/i18n'
import { moduleLink } from '../../lib/links'
import { buttonClass } from './buttons'
import { InsetList, InsetRow, SectionFooter, SectionLabel } from './InsetList'
import { ModuleTile } from './ModuleTile'
import { RowMenu } from './RowMenu'
import { Pill } from './ShellPrimitives'
import { useRequiredCurrentGroup } from './useCurrentGroup'

/**
 * Every Module in this Group, pinned or not.
 *
 * This is what makes a large Module count tolerable without any Group ever
 * enabling or disabling one: everything is here, always, and Pins only decide
 * what you personally see first. It is a page rather than a sidebar section so
 * that the desktop sidebar and the mobile dock can end in the same place.
 *
 * Pin and Unpin live in each row's `⋯` menu, and the arrows that move a pin
 * only appear in Reorder mode (web-shell_final.md, "Module page"), so the list
 * reads as a list until you ask to change it.
 */
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
  const [reorderMode, setReorderMode] = useState(false)
  // One pin has no order, and the Done button goes with the second one.
  const reordering = reorderMode && pinned.length > 1
  if (reorderMode && loaded && !reordering) setReorderMode(false)
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

  // Unpinning takes the row, and the focus on its menu, out of the pinned
  // list once Convex answers. Focus moves to the pin that took its place, the
  // last one, or with none left the Module's own row below.
  const pageRef = useRef<HTMLDivElement>(null)
  const [unpinned, setUnpinned] = useState<{ id: string; at: number } | null>(
    null,
  )
  useEffect(() => {
    if (!unpinned || !loaded) return
    const left = order === '' ? [] : order.split(',')
    if (left.includes(unpinned.id)) return
    setUnpinned(null)
    // Still somewhere (its row below, or wherever the reader went since).
    if (document.activeElement !== document.body) return
    const row =
      left.length > 0
        ? `[data-pin="${left[Math.min(unpinned.at, left.length - 1)]}"]`
        : `[data-module="${unpinned.id}"]`
    pageRef.current
      ?.querySelector<HTMLElement>(`${row} [data-row-menu]`)
      ?.focus()
  }, [unpinned, loaded, order])

  const write = (next: string[]) => {
    setAnnouncement('')
    // A refused unpin leaves its row, so there is no focus to move later.
    void savePins({ groupSlug, moduleIds: next }).catch((error: unknown) => {
      setUnpinned(null)
      throw error
    })
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

  const label = (module: ModuleDef) => moduleText(module, messages).label
  const pinAction = (module: ModuleDef) => {
    const isOn = ids.includes(module.id)
    return {
      id: isOn ? 'unpin' : 'pin',
      label: isOn ? allModules.unpin : allModules.pin,
      onSelect: () => {
        if (isOn) setUnpinned({ id: module.id, at: ids.indexOf(module.id) })
        write(togglePin(ids, module.id))
      },
    }
  }

  return (
    <div ref={pageRef} className="mx-auto grid max-w-3xl gap-6">
      <header>
        <h1 className="m-0 font-rounded text-large-title font-bold">
          {allModules.title}
        </h1>
        <p className="mt-1 mb-0 text-subhead text-[var(--muted)]">
          {allModules.intro}
        </p>
      </header>

      <section aria-labelledby="pins-heading">
        <SectionLabel
          id="pins-heading"
          action={
            pinned.length > 1 ? (
              <button
                type="button"
                className={buttonClass.small}
                onClick={() => setReorderMode((on) => !on)}
              >
                {reordering ? allModules.reorderDone : allModules.reorder}
              </button>
            ) : null
          }
        >
          {allModules.yourPins}
        </SectionLabel>
        <p role="status" aria-live="polite" className="sr-only">
          {announcement}
        </p>
        {pinned.length === 0 ? (
          <p className="m-0 rounded-[var(--radius-card)] bg-[var(--surface)] px-4 py-3.5 text-subhead text-[var(--muted)]">
            {loaded ? allModules.nothingPinned : loading}
          </p>
        ) : (
          <InsetList>
            {pinned.map((module, index) => (
              <InsetRow
                key={module.id}
                title={label(module)}
                link={moduleLink(module)}
                leading={<ModuleTile group={module.group} icon={module.icon} />}
                menu={
                  <span data-pin={module.id}>
                    <RowMenu
                      item={label(module)}
                      actions={[pinAction(module)]}
                    />
                  </span>
                }
                controls={
                  reordering ? (
                    <>
                      <button
                        type="button"
                        className={buttonClass.smallRound}
                        disabled={index === 0}
                        data-move={`${module.id}:up`}
                        aria-label={fmt(allModules.moveUp, {
                          module: label(module),
                        })}
                        onClick={() => move(module, 'up')}
                      >
                        <ArrowUp className="size-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className={buttonClass.smallRound}
                        disabled={index === pinned.length - 1}
                        data-move={`${module.id}:down`}
                        aria-label={fmt(allModules.moveDown, {
                          module: label(module),
                        })}
                        onClick={() => move(module, 'down')}
                      >
                        <ArrowDown className="size-4" aria-hidden="true" />
                      </button>
                    </>
                  ) : undefined
                }
              />
            ))}
          </InsetList>
        )}
        {reordering ? (
          <SectionFooter>{allModules.reorderHint}</SectionFooter>
        ) : null}
      </section>

      {MODULE_GROUPS.map((group) => {
        const heading = messages.modules.groups[group]
        const headingId = `modules-${group}`
        return (
          <section key={group} aria-labelledby={headingId}>
            <SectionLabel id={headingId}>{heading}</SectionLabel>
            <InsetList>
              {byGroup[group].map((module) => (
                <InsetRow
                  key={module.id}
                  title={label(module)}
                  link={moduleLink(module)}
                  leading={
                    <ModuleTile group={module.group} icon={module.icon} />
                  }
                  trailing={
                    module.status === 'placeholder' ? (
                      <Pill>{marks.soon}</Pill>
                    ) : ids.includes(module.id) ? (
                      <span className="text-footnote">{allModules.pinned}</span>
                    ) : undefined
                  }
                  // Until the pins arrive, Pin and Unpin would be guesses.
                  menu={
                    loaded ? (
                      <span data-module={module.id}>
                        <RowMenu
                          item={label(module)}
                          actions={[pinAction(module)]}
                        />
                      </span>
                    ) : undefined
                  }
                />
              ))}
            </InsetList>
          </section>
        )
      })}
    </div>
  )
}
