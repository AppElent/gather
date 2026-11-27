/** The colour and icon a list wears, chosen (New list, Colour and icon). */
import {
  iconChoices,
  TASK_LIST_COLORS,
  type TaskListColor,
  type TaskListIcon,
  type TaskListKind,
} from '@gather/core/task-lists'
import { useI18n } from '../../lib/i18n'
import { Icon } from '../app/Icon'
import { LIST_GLYPHS } from './ListTile'

const CHOICE =
  'grid size-[var(--size-control-min)] cursor-pointer place-items-center rounded-[var(--radius-pill)] border-2 bg-transparent p-0'
const ring = (chosen: boolean) =>
  chosen ? 'border-[var(--ink)]' : 'border-transparent'

export function FaceChoices({
  kind,
  color,
  icon,
  onColor,
  onIcon,
}: {
  kind: TaskListKind
  color: TaskListColor
  icon: TaskListIcon
  onColor: (color: TaskListColor) => void
  onIcon: (icon: TaskListIcon) => void
}) {
  const { messages: t } = useI18n()
  const words = t.tasks.newList
  return (
    <div className="grid gap-1 rounded-2xl bg-[var(--ground)] px-3.5 py-1.5">
      <fieldset className="m-0 flex flex-wrap items-center gap-1 border-0 p-0">
        <legend className="float-left mr-auto p-0">{words.color}</legend>
        {TASK_LIST_COLORS.map((each) => (
          <button
            key={each}
            type="button"
            aria-label={t.tasks.colors[each]}
            aria-pressed={each === color}
            onClick={() => onColor(each)}
            className={`${CHOICE} ${ring(each === color)}`}
          >
            <span
              data-group={each}
              className="size-7 rounded-[var(--radius-pill)] bg-[var(--accent)]"
            />
          </button>
        ))}
      </fieldset>
      <fieldset className="m-0 flex flex-wrap items-center gap-1 border-0 p-0">
        <legend className="float-left mr-auto p-0">{words.icon}</legend>
        {iconChoices(kind).map((each) => (
          <button
            key={each}
            type="button"
            aria-label={t.tasks.icons[each]}
            aria-pressed={each === icon}
            onClick={() => onIcon(each)}
            className={`${CHOICE} ${ring(each === icon)}`}
          >
            <Icon name={LIST_GLYPHS[each]} className="size-5" />
          </button>
        ))}
      </fieldset>
    </div>
  )
}
