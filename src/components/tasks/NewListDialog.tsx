/**
 * New list (APP-306): a name, a kind, a colour and an icon, or a list linked
 * from a provider. An empty name means the kind's own.
 */
import {
  TASK_LIST_KINDS,
  TASK_LIST_TEMPLATES,
  type TaskListColor,
  type TaskListIcon,
  type TaskListKind,
} from '@gather/core/task-lists'
import { useMutation } from 'convex/react'
import { Check } from 'lucide-react'
import { type FormEvent, useId, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { useErrorMessage } from '../../lib/errorMessage'
import { useI18n } from '../../lib/i18n'
import { buttonClass } from '../app/buttons'
import { Dialog } from '../app/Dialog'
import { ModuleTile } from '../app/ModuleTile'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import { inputClass } from '../recipes/fields'
import { AddListFlow } from './AddListFlow'
import { LIST_GLYPHS } from './ListTile'
import { FaceChoices } from './listFace'

/** The longest name the form takes: more never fits a row. */
export const LIST_NAME_MAX = 100

export function NewListDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (list: { id: string; kind: TaskListKind }) => void
}) {
  const { messages: t } = useI18n()
  const { slug: groupSlug } = useRequiredCurrentGroup()
  const createList = useMutation(api.taskLists.create)
  const errorText = useErrorMessage()
  const formId = useId()
  const nameRef = useRef<HTMLInputElement>(null)
  const [linking, setLinking] = useState(false)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<TaskListKind>('plain')
  // Null follows the kind, until somebody picks one.
  const [color, setColor] = useState<TaskListColor | null>(null)
  const [icon, setIcon] = useState<TaskListIcon | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // One key per dialog: a retry after a dropped connection is the same list.
  const [idempotencyKey] = useState(() => crypto.randomUUID())

  const template = TASK_LIST_TEMPLATES[kind]
  const kindWords = t.tasks.kinds[kind]
  const face = { icon: icon ?? template.icon, color: color ?? template.color }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const id = await createList({
        name: name.trim().slice(0, LIST_NAME_MAX) || kindWords.defaultName,
        provider: 'local',
        groupSlug,
        kind,
        ...face,
        starterSections: template.sections.map(({ section, items }) => ({
          name: t.tasks.starterSections[section],
          tasks: items.map((key) => t.tasks.starters[key]),
        })),
        keepGroceryList: true,
        idempotencyKey,
      })
      onClose()
      onCreated({ id, kind })
    } catch (cause) {
      setError(errorText(cause, t.tasks.newList.failed))
      setBusy(false)
    }
  }

  if (linking) {
    return (
      <Dialog title={t.tasks.addList.title} onClose={onClose}>
        <AddListFlow groupSlug={groupSlug} onDone={onClose} />
      </Dialog>
    )
  }

  return (
    <Dialog
      title={t.tasks.newList.title}
      onClose={onClose}
      initialFocus={nameRef}
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
            disabled={busy}
            className={buttonClass.primary}
          >
            {t.tasks.newList.create}
          </button>
        </>
      }
    >
      <form
        id={formId}
        onSubmit={(event) => void submit(event)}
        className="grid gap-4"
      >
        <div className="flex items-center gap-3.5">
          <ModuleTile group={face.color} icon={LIST_GLYPHS[face.icon]} size="l" />
          <input
            ref={nameRef}
            value={name}
            maxLength={LIST_NAME_MAX}
            onChange={(event) => setName(event.target.value)}
            placeholder={kindWords.defaultName}
            aria-label={t.tasks.newList.nameLabel}
            autoComplete="off"
            className={`${inputClass} min-h-[var(--size-control-min)] min-w-0 flex-1`}
          />
        </div>

        <div className="grid gap-2">
          <h3 className="m-0 px-1 text-footnote font-semibold text-[var(--muted)]">
            {t.tasks.newList.kind}
          </h3>
          <ul
            aria-label={t.tasks.newList.kind}
            className="m-0 list-none overflow-hidden rounded-2xl bg-[var(--ground)] p-0"
          >
            {TASK_LIST_KINDS.map((each) => (
              <li
                key={each}
                className="[&+&]:border-t-[0.5px] [&+&]:border-[var(--hair)]"
              >
                <button
                  type="button"
                  aria-pressed={each === kind}
                  onClick={() => {
                    setKind(each)
                    setIcon(null)
                  }}
                  className="flex min-h-14 w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-3.5 py-2 text-left font-[inherit] text-[var(--ink)] hover:bg-[var(--surface-2)]"
                >
                  <ModuleTile
                    icon={LIST_GLYPHS[TASK_LIST_TEMPLATES[each].icon]}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-body">
                      {t.tasks.kinds[each].title}
                    </span>
                    <span className="block text-footnote text-[var(--muted)]">
                      {t.tasks.kinds[each].description}
                    </span>
                  </span>
                  {each === kind ? (
                    <Check
                      className="size-5 shrink-0 text-[var(--home-text)]"
                      aria-hidden="true"
                    />
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
          <p className="m-0 px-1 text-footnote text-[var(--muted)]">
            {kindWords.startsWith}
          </p>
        </div>

        <FaceChoices
          kind={kind}
          {...face}
          onColor={setColor}
          onIcon={setIcon}
        />

        {error ? (
          <p
            role="alert"
            className="m-0 px-1 text-footnote font-semibold text-[var(--danger)]"
          >
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => setLinking(true)}
          className="min-h-[var(--size-control-min)] cursor-pointer justify-self-start border-0 bg-transparent px-1 font-[inherit] font-semibold text-[var(--home-text)]"
        >
          {t.tasks.web.addLinked}
        </button>
      </form>
    </Dialog>
  )
}
