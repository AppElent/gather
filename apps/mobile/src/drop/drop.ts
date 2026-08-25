/**
 * What a Drop is, and how one is read out of what the OS hands over.
 *
 * The share sheet delivers a loose shape — a type string, maybe a URL, maybe
 * some text, maybe a list of files — and the rest of the flow wants one of
 * three definite things (ADR-0028). This is the door between them, and it is a
 * pure function on purpose: it is the only place a payload is interpreted, so
 * it is the only place that has to be right about the awkward cases.
 *
 * Two of those cases are worth naming, because both platforms produce them:
 *
 * - **A link often arrives as text.** Android in particular shares a URL with
 *   `type: 'text'` and no `webUrl`, and treating it as a paragraph would offer
 *   Notes for a page that wants the recipe importer.
 * - **A share can carry both.** iOS hands over a `weburl` with the page title
 *   in `meta`, and some apps add a text excerpt alongside. The link wins: it is
 *   the thing Gather can actually read.
 */
import { dropHost } from '@gather/core/drop-rules'
import type { ShareIntent } from 'expo-share-intent'

export type Drop =
  | {
      kind: 'url'
      url: string
      /** Lowercased, `www.`-stripped, or `null` when the link will not parse. */
      host: string | null
      /** The page title, when the sharing app bothered to send one. */
      title?: string
    }
  | { kind: 'text'; text: string }
  | {
      kind: 'image'
      /** A local `file://` URI, read with `expo-file-system` and never `fetch`. */
      uri: string
      mimeType: string
    }

/**
 * The first line of a text Drop, which is what a note or a task is called.
 *
 * Trimmed and capped, because a share can be a whole article and neither a
 * note list nor a checklist has room for one. The remainder becomes the body,
 * so nothing shared is thrown away by the split.
 */
export const DROP_TITLE_MAX = 80

export function dropTitle(text: string): string {
  const line = text
    .split('\n')
    .map((each) => each.trim())
    .find((each) => each.length > 0)
  if (!line) return ''
  return line.length > DROP_TITLE_MAX
    ? `${line.slice(0, DROP_TITLE_MAX - 1).trimEnd()}…`
    : line
}

/**
 * Everything after the first non-empty line, which is a note's body.
 *
 * A one-line share has no body, and a note whose body repeats its title reads
 * like a bug.
 */
export function dropBody(text: string): string {
  const lines = text.split('\n')
  const first = lines.findIndex((each) => each.trim().length > 0)
  if (first === -1) return ''
  return lines
    .slice(first + 1)
    .join('\n')
    .trim()
}

/**
 * What appending adds to a note that already has a body.
 *
 * At the bottom, after a blank line, and with no timestamp: a note is prose
 * somebody is writing, and stamping every addition turns it into a log. The
 * blank line is the whole separator, because `body` is a plain string and
 * anything richer would be inventing a format Notes has not decided on.
 */
export function appendedBody(existing: string, addition: string): string {
  const base = existing.trimEnd()
  if (!addition) return base
  return base ? `${base}\n\n${addition}` : addition
}

/** What the chooser calls the Drop while somebody decides where it goes. */
export function dropDisplayTitle(drop: Drop): string {
  if (drop.kind === 'url') return drop.title || drop.url
  if (drop.kind === 'text') return dropTitle(drop.text)
  return ''
}

/** The line under it, when there is a link to name a site from. */
export function dropDisplayHost(drop: Drop): string | null {
  return drop.kind === 'url' ? drop.host : null
}

/**
 * The Drop a `gather://drop?url=…` address carries, if any.
 *
 * This exists because the share sheet cannot be automated: `agent-device`
 * drives Gather, not Safari, so the only way to verify the flow on a device is
 * an address that produces the same Drop the OS would have (ADR-0028). It is
 * not a second door into the feature — it lands on the same chooser, over the
 * same provider, and can carry only what a route param can hold, which is why
 * a photo Drop has no harness at all.
 */
export function dropFromLink(params: {
  url?: string
  text?: string
}): Drop | null {
  const url = params.url?.trim()
  if (url) return { kind: 'url', url, host: dropHost(url) }
  const text = params.text?.trim()
  if (text) {
    const link = bareUrl(text)
    if (link) return { kind: 'url', url: link, host: dropHost(link) }
    return { kind: 'text', text }
  }
  return null
}

/** A share that is nothing but a link, whatever the OS called it. */
function bareUrl(text: string): string | null {
  const trimmed = text.trim()
  if (/\s/.test(trimmed)) return null
  return dropHost(trimmed) ? trimmed : null
}

/**
 * The Drop inside a share intent, or `null` when there is nothing usable.
 *
 * `null` is not an error worth showing anybody: it means another app offered
 * Gather something it declared it could take and then sent nothing in it, and
 * the honest response is to carry on as if the share had not happened.
 */
export function dropFromShareIntent(intent: ShareIntent): Drop | null {
  const title = intent.meta?.title?.trim() || undefined

  if (intent.webUrl) {
    const url = intent.webUrl.trim()
    return { kind: 'url', url, host: dropHost(url), title }
  }

  const image = intent.files?.find((file) =>
    file.mimeType?.startsWith('image/'),
  )
  if (image?.path) {
    return { kind: 'image', uri: image.path, mimeType: image.mimeType }
  }

  const text = intent.text?.trim()
  if (text) {
    const link = bareUrl(text)
    if (link) return { kind: 'url', url: link, host: dropHost(link), title }
    return { kind: 'text', text }
  }

  return null
}
