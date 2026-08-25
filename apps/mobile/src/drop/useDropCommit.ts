/**
 * Turning a Drop into a thing, and answering where the person now stands.
 *
 * Nearly every write here already existed before Drops did: the recipe URL
 * import, note create and update, task add, baby event add, tasting subject
 * update. That is the point — a Drop aimed at Recipes *is* an Import as
 * `CONTEXT.md` already defines one, so this added no second reader of anything.
 * The one exception is `recipes.setPhoto`, and the reason is in that mutation's
 * own docstring: `recipes.update` takes the whole recipe, so a caller holding
 * only a storage id would have to read a recipe back and write it out again to
 * change one field.
 *
 * ## Nothing runs before a person confirms
 *
 * Two destinations need to look something up — a memory needs a Child, a
 * grocery line needs the list the Group designated — and both do it with a
 * **one-shot query inside the commit**, never a subscription at hook level. A
 * `useQuery` here would fire the moment the chooser rendered, which is exactly
 * the "nothing expensive before a person confirms" rule of ADR-0028, broken by
 * the file that quotes it.
 *
 * ## The Drop names its Group
 *
 * `groupSlug` is a parameter rather than a read of the ambient Group. The
 * chooser lets somebody aim a Drop at a Group they are not standing in, and the
 * app follows it there **after** the write — so the write names its own
 * destination rather than depending on a switch having already happened
 * (ADR-0007).
 *
 * ## A precondition is a sentence, not a dead end
 *
 * A missing Child or an undesignated grocery list answers with a `DropProblem`
 * rather than throwing or navigating somewhere unhelpful, so the chooser can
 * say what is missing **with the Drop still pending**. Nothing shared is lost
 * by finding out late.
 */
import { useConvex, useMutation } from 'convex/react'
import type { Href } from 'expo-router'
import { useCallback } from 'react'

import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { resolveSelectedChild } from '../modules/baby/selectedChild'
import { preparePhoto, uploadPhoto } from '../photo/pickPhoto'
import { babyChildKey, readPreference } from '../prefs/localPreference'
import { appendedBody, type Drop, dropBody, dropTitle } from './drop'
import type { DropTarget } from './dropTargets'

/**
 * A record stage two picked, and enough of it to write with.
 *
 * `name` is carried because `tastings.updateSubject` takes the whole subject
 * rather than a patch, and `body` because appending has to append to something.
 * Both are already on screen in the picker, so reading them back from the
 * server would be a round-trip to learn what somebody just pointed at.
 */
export interface DropPicked {
  id: string
  name?: string
  body?: string
  /** Whether the target already holds a photo, so replacing one can ask first. */
  hasPhoto?: boolean
}

/** Something the household has not set up yet. Reported, never thrown. */
export type DropProblem = 'no-child' | 'no-grocery-list'

export type DropCommit =
  | { ok: true; href: Href }
  | { ok: false; problem: DropProblem }

export interface DropCommitInput {
  target: DropTarget
  drop: Drop
  /** The Group the Drop named on the chooser (ADR-0007). */
  groupSlug: string
  /** What stage two picked, for the targets that ask. */
  pick?: DropPicked
}

/** What a link becomes when it has to be a line of text. */
function lineOf(drop: Drop): string {
  if (drop.kind === 'url') return drop.title || drop.host || drop.url
  if (drop.kind === 'text') return dropTitle(drop.text)
  return ''
}

/**
 * The body a new note gets.
 *
 * A link keeps its address, because a note whose title is a page name and whose
 * body is empty has thrown away the only part that can be opened again.
 */
function bodyOf(drop: Drop): string {
  if (drop.kind === 'url') return drop.url
  if (drop.kind === 'text') return dropBody(drop.text)
  return ''
}

/** Both lines a Drop contributes to a note it is joining. */
function appendedText(drop: Drop): string {
  if (drop.kind === 'url') {
    return drop.title ? `${drop.title}\n${drop.url}` : drop.url
  }
  if (drop.kind === 'text') return drop.text.trim()
  return ''
}

export function useDropCommit() {
  // The client itself, for the two lookups that must not become subscriptions
  // — see the note at the top.
  const convex = useConvex()

  const createNote = useMutation(api.notes.create)
  const updateNote = useMutation(api.notes.update)
  const addTask = useMutation(api.tasks.add)
  const addBabyEvent = useMutation(api.babyEvents.add)
  const setRecipePhoto = useMutation(api.recipes.setPhoto)
  const updateSubject = useMutation(api.tastings.updateSubject)
  const babyUploadUrl = useMutation(api.babies.generateUploadUrl)
  const recipeUploadUrl = useMutation(api.recipes.generateUploadUrl)
  const tastingUploadUrl = useMutation(api.tastings.generateUploadUrl)

  return useCallback(
    async function commit({
      target,
      drop,
      groupSlug,
      pick,
    }: DropCommitInput): Promise<DropCommit> {
      /**
       * Prepare, upload, and answer with the id plus the local file it came
       * from — the recipe form draws that while it has no row to read a stored
       * URL off yet.
       */
      async function storePhoto(
        generate: () => Promise<string>,
        preset: 'memoryPhoto' | 'recipePhoto',
      ): Promise<{ storageId: Id<'_storage'>; uri: string }> {
        if (drop.kind !== 'image') throw new Error('Not a photo Drop')
        const prepared = await preparePhoto(drop.uri, preset)
        const storageId = await uploadPhoto(prepared.uri, await generate())
        return { storageId: storageId as Id<'_storage'>, uri: prepared.uri }
      }

      switch (target.id) {
        // Nothing is written here: the importer is the destination, and it
        // reads the page itself exactly as it does when somebody pastes a link
        // into it. The Drop therefore stays pending until that screen saves —
        // see the chooser, which does not clear it for this one target.
        case 'recipe-import':
          return {
            ok: true,
            href: {
              pathname: '/all/recipes/import',
              params: { link: drop.kind === 'url' ? drop.url : '' },
            } as Href,
          }

        case 'recipe-new-photo': {
          const { storageId, uri } = await storePhoto(
            recipeUploadUrl,
            'recipePhoto',
          )
          return {
            ok: true,
            href: {
              pathname: '/all/recipes/new',
              params: { photoId: storageId, photoUri: uri },
            } as Href,
          }
        }

        case 'recipe-photo': {
          if (!pick) throw new Error('A recipe photo needs a recipe')
          const { storageId } = await storePhoto(recipeUploadUrl, 'recipePhoto')
          await setRecipePhoto({
            id: pick.id as Id<'recipes'>,
            imageId: storageId,
          })
          return { ok: true, href: target.route({ id: pick.id }) }
        }

        case 'note-new': {
          const noteId = await createNote({
            groupSlug,
            title: lineOf(drop),
            body: bodyOf(drop),
          })
          return { ok: true, href: target.route({ id: noteId }) }
        }

        case 'note-append': {
          if (!pick) throw new Error('Appending needs a note')
          await updateNote({
            groupSlug,
            noteId: pick.id as Id<'notes'>,
            body: appendedBody(pick.body ?? '', appendedText(drop)),
          })
          return { ok: true, href: target.route({ id: pick.id }) }
        }

        case 'task-new': {
          if (!pick) throw new Error('A task needs a list')
          await addTask({
            groupSlug,
            listId: pick.id as Id<'taskLists'>,
            title: lineOf(drop),
          })
          return { ok: true, href: target.route({ id: pick.id }) }
        }

        case 'grocery-line': {
          // The Group designates its grocery list, so there is nothing to ask —
          // unless it has not, which is the one thing that can stop this.
          const { groceryListId } = await convex.query(api.kitchen.overview, {
            groupSlug,
          })
          if (!groceryListId) return { ok: false, problem: 'no-grocery-list' }
          await addTask({
            groupSlug,
            listId: groceryListId,
            title: lineOf(drop),
          })
          return { ok: true, href: target.route({ id: groceryListId }) }
        }

        case 'baby-memory': {
          const babies = await convex.query(api.babies.list, { groupSlug })
          // The Child the Baby log itself opens on, resolved against the list
          // rather than trusted: a remembered id can outlive the Child.
          const child = resolveSelectedChild(
            babies,
            readPreference(babyChildKey(groupSlug)),
          )
          if (!child) return { ok: false, problem: 'no-child' }
          const { storageId } = await storePhoto(babyUploadUrl, 'memoryPhoto')
          await addBabyEvent({
            groupSlug,
            babyId: child._id,
            type: 'memory',
            timestamp: Date.now(),
            photoId: storageId,
            // A memory is one sentence about what happened, and a share sheet
            // does not carry one. Left empty for whoever writes it in the
            // timeline rather than filled with a filename.
            data: { what: '' },
          })
          return { ok: true, href: target.route({ id: child._id }) }
        }

        case 'cheese-photo':
        case 'wine-photo':
        case 'beer-photo': {
          if (!pick) throw new Error('A tasting photo needs a subject')
          // `recipePhoto` is the preset the tasting Module already names for a
          // subject's picture (`SubjectScreen`), and a second name for the same
          // numbers is what ADR-0010's one table exists to prevent.
          const { storageId } = await storePhoto(
            tastingUploadUrl,
            'recipePhoto',
          )
          await updateSubject({
            groupSlug,
            id: pick.id as Id<'tastingSubjects'>,
            name: pick.name ?? '',
            photoId: storageId,
          })
          return { ok: true, href: target.route({ id: pick.id }) }
        }
      }
    },
    [
      addBabyEvent,
      addTask,
      babyUploadUrl,
      convex,
      createNote,
      recipeUploadUrl,
      setRecipePhoto,
      tastingUploadUrl,
      updateNote,
      updateSubject,
    ],
  )
}
