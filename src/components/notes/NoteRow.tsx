import { Pin, PinOff, Trash2 } from 'lucide-react'
import { useI18n } from '../../lib/i18n'
import type { AppLink } from '../../lib/links'
import { InsetRow } from '../app/InsetList'
import { RowMenu } from '../app/RowMenu'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import { useNoteDraft } from './noteDrafts'
import { noteWhen, preview } from './noteText'
import { type Note, useDraftKey } from './useNotes'

/** Title over when and first line; says so when the note has unsaved text. */
export function NoteRow({
  note,
  selected,
  link,
  onTogglePin,
  onDelete,
}: {
  note: Pick<Note, '_id' | 'title' | 'body' | 'pinned' | 'updatedAt'>
  selected: boolean
  link: AppLink
  onTogglePin: () => void
  onDelete: () => void
}) {
  const { locale, messages } = useI18n()
  const words = messages.notes
  const { timeZone } = useRequiredCurrentGroup()
  const failed = useNoteDraft(useDraftKey()(note._id))?.state === 'failed'
  const title = note.title.trim() || words.untitled

  return (
    <InsetRow
      title={
        <span data-note={note._id} className="block truncate font-semibold">
          {title}
        </span>
      }
      footnote={
        <span className="block truncate">
          {[
            failed
              ? words.web.notSaved
              : noteWhen(note.updatedAt, locale, words.today, timeZone),
            preview(note.body),
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      }
      footnoteTone={failed ? 'danger' : 'muted'}
      selected={selected}
      link={link}
      chevron={false}
      menu={
        <RowMenu
          item={title}
          actions={[
            {
              id: 'pin',
              label: note.pinned ? words.unpin : words.pin,
              icon: note.pinned ? (
                <PinOff className="size-4" aria-hidden="true" />
              ) : (
                <Pin className="size-4" aria-hidden="true" />
              ),
              onSelect: onTogglePin,
            },
            {
              id: 'delete',
              label: words.delete,
              danger: true,
              icon: <Trash2 className="size-4" aria-hidden="true" />,
              onSelect: onDelete,
            },
          ]}
        />
      }
    />
  )
}
