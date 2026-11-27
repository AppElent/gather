/** What a list's `⋯` opens: its name, its face, its rows and its sections. */
import { TASK_SECTION_NAME_MAX } from '@gather/core/task-lists'
import type { TaskList } from '@gather/core/task-model'
import { Plus } from 'lucide-react'
import { type FormEvent, useId, useRef, useState } from 'react'
import { fmt, useI18n } from '../../lib/i18n'
import { buttonClass } from '../app/buttons'
import { Dialog } from '../app/Dialog'
import { RowMenu } from '../app/RowMenu'
import { inputClass } from '../recipes/fields'
import { FaceChoices } from './listFace'
import { LIST_NAME_MAX } from './NewListDialog'
import { useWorkspace } from './TasksWorkspace'

export type ListDialogKind = 'display' | 'rename' | 'appearance' | 'sections'

export function ListDialog({
  kind,
  list,
  onClose,
}: {
  kind: ListDialogKind
  list: TaskList
  onClose: () => void
}) {
  switch (kind) {
    case 'display':
      return <DisplayDialog list={list} onClose={onClose} />
    case 'rename':
      return <RenameDialog list={list} onClose={onClose} />
    case 'appearance':
      return <AppearanceDialog list={list} onClose={onClose} />
    case 'sections':
      return <SectionsDialog list={list} onClose={onClose} />
  }
}

interface Props {
  list: TaskList
  onClose: () => void
}

function DisplayDialog({ list, onClose }: Props) {
  const words = useI18n().messages.tasks.web.listMenu
  const { actions, fail } = useWorkspace()
  const fields = [
    { id: 'due', label: words.dueDates },
    { id: 'priority', label: words.priority },
    { id: 'labels', label: words.labels },
  ] as const
  return (
    <Dialog title={words.display} onClose={onClose}>
      <ul className="m-0 list-none overflow-hidden rounded-2xl bg-[var(--ground)] p-0">
        {fields.map(({ id, label }) => (
          <li
            key={id}
            className="[&+&]:border-t-[0.5px] [&+&]:border-[var(--hair)]"
          >
            <label className="flex min-h-[46px] cursor-pointer items-center justify-between gap-3 px-3.5">
              {label}
              <input
                type="checkbox"
                checked={list.display[id]}
                onChange={(event) => {
                  actions
                    .setListDisplay(list, { [id]: event.target.checked })
                    .catch(fail)
                }}
                className="size-5 accent-[var(--ink)]"
              />
            </label>
          </li>
        ))}
      </ul>
    </Dialog>
  )
}

function RenameDialog({ list, onClose }: Props) {
  const { messages: t } = useI18n()
  const { actions, fail } = useWorkspace()
  const formId = useId()
  const ref = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(list.name)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const next = name.trim()
    if (!next) return
    onClose()
    if (next !== list.name) actions.renameList(list.id, next).catch(fail)
  }
  return (
    <Dialog
      title={t.tasks.web.listMenu.rename}
      onClose={onClose}
      initialFocus={ref}
      actions={
        <>
          <button
            type="button"
            onClick={onClose}
            className={buttonClass.secondary}
          >
            {t.common.actions.cancel}
          </button>
          <button
            type="submit"
            form={formId}
            disabled={!name.trim()}
            className={buttonClass.primary}
          >
            {t.common.actions.save}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={submit}>
        <input
          ref={ref}
          value={name}
          maxLength={LIST_NAME_MAX}
          onChange={(event) => setName(event.target.value)}
          aria-label={t.tasks.newList.nameLabel}
          className={`${inputClass} min-h-[var(--size-control-min)] w-full`}
        />
      </form>
    </Dialog>
  )
}

function AppearanceDialog({ list, onClose }: Props) {
  const { messages: t } = useI18n()
  const { actions, fail } = useWorkspace()
  return (
    <Dialog title={t.tasks.appearance.title} onClose={onClose}>
      <FaceChoices
        kind={list.kind}
        color={list.color}
        icon={list.icon}
        onColor={(color) => {
          actions.setListAppearance(list.id, { color }).catch(fail)
        }}
        onIcon={(icon) => {
          actions.setListAppearance(list.id, { icon }).catch(fail)
        }}
      />
    </Dialog>
  )
}

/** Each section is a field, its `⋯` moves or deletes it, the last row adds. */
function SectionsDialog({ list, onClose }: Props) {
  const { messages: t } = useI18n()
  const words = t.tasks.sections
  const { actions, fail, confirm } = useWorkspace()
  const [draft, setDraft] = useState('')
  const sections = list.sections

  const add = (event: FormEvent) => {
    event.preventDefault()
    const name = draft.trim()
    if (!name) return
    setDraft('')
    actions.addSection(list.id, name).catch((error) => {
      setDraft((now) => now || name)
      fail(error)
    })
  }
  const move = (from: number, to: number) => {
    const ids = sections.map((section) => section.id)
    ids.splice(to, 0, ...ids.splice(from, 1))
    actions.reorderSections(list.id, ids).catch(fail)
  }

  return (
    <Dialog title={words.title} onClose={onClose}>
      {sections.length === 0 ? (
        <p className="m-0 mb-3 text-subhead text-[var(--muted)]">
          {words.sheetEmpty}
        </p>
      ) : null}
      <ul className="m-0 list-none rounded-2xl bg-[var(--ground)] p-0">
        {sections.map((section, at) => (
          <li
            key={section.id}
            className="flex items-center pr-2 pl-3.5 [&+&]:border-t-[0.5px] [&+&]:border-[var(--hair)]"
          >
            <SectionName
              // A rename elsewhere replaces what this field holds.
              key={section.name}
              name={section.name}
              onRename={(name) => {
                actions.renameSection(list.id, section.id, name).catch(fail)
              }}
            />
            <RowMenu
              item={section.name}
              alwaysVisible
              actions={[
                ...(at > 0
                  ? [
                      {
                        id: 'up',
                        label: words.moveUp,
                        onSelect: () => move(at, at - 1),
                      },
                    ]
                  : []),
                ...(at < sections.length - 1
                  ? [
                      {
                        id: 'down',
                        label: words.moveDown,
                        onSelect: () => move(at, at + 1),
                      },
                    ]
                  : []),
                {
                  id: 'delete',
                  label: words.delete,
                  danger: true,
                  onSelect: () =>
                    confirm({
                      title: fmt(words.deleteTitle, { name: section.name }),
                      body: words.deleteBody,
                      confirmLabel: t.common.actions.delete,
                      errorFallback: t.tasks.web.failed,
                      run: () => actions.removeSection(list.id, section.id),
                    }),
                },
              ]}
            />
          </li>
        ))}
        <li className="px-3.5 [li+&]:border-t-[0.5px] [li+&]:border-[var(--hair)]">
          <form onSubmit={add} className="flex items-center gap-2.5">
            <Plus
              className="size-[18px] shrink-0 text-[var(--home-text)]"
              aria-hidden="true"
            />
            <input
              value={draft}
              maxLength={TASK_SECTION_NAME_MAX}
              onChange={(event) => setDraft(event.target.value)}
              aria-label={words.add}
              placeholder={words.newPlaceholder}
              enterKeyHint="done"
              autoComplete="off"
              className="min-h-[46px] min-w-0 flex-1 border-0 bg-transparent text-[16px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
            />
          </form>
        </li>
      </ul>
    </Dialog>
  )
}

/** Renamed by typing; an emptied field puts the name back. */
function SectionName({
  name,
  onRename,
}: {
  name: string
  onRename: (name: string) => void
}) {
  const words = useI18n().messages.tasks.sections
  const [draft, setDraft] = useState(name)
  return (
    <input
      value={draft}
      maxLength={TASK_SECTION_NAME_MAX}
      aria-label={`${words.rename}: ${name}`}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        const next = draft.trim()
        if (!next) setDraft(name)
        else if (next !== name) onRename(next)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
      }}
      className="min-h-[46px] min-w-0 flex-1 rounded-lg border-0 bg-transparent text-[16px] text-[var(--ink)] outline-none focus-visible:outline-2 focus-visible:outline-[var(--ink)]"
    />
  )
}
