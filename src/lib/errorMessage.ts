import { ConvexError } from 'convex/values'

/**
 * The readable half of something thrown by a Convex call.
 *
 * Convex refusals are `ConvexError`s carrying the sentence the backend wanted
 * shown ("List not found"), so that is what a reader gets. Anything else is an
 * `Error` we did not write the wording for; its message is still more use to a
 * reader than silence, and the fallback is there for what is not an `Error` at
 * all.
 *
 * This lived in three copies before — `EventForm`, `ConnectionsSettings`, and
 * inline in the Groups page — which is how two of them ended up disagreeing
 * about whether a plain `Error`'s message was worth showing. One copy now, and
 * the answer is yes.
 */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ConvexError) {
    return typeof error.data === 'string' ? error.data : fallback
  }
  return error instanceof Error && error.message ? error.message : fallback
}
