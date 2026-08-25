/**
 * Reading a Drop out of what the OS handed over.
 *
 * The awkward cases here are not hypothetical: both platforms really do send a
 * link as plain text, and a share really can arrive carrying two things at
 * once. Getting either wrong sends a recipe page to Notes, which is the exact
 * failure the ranking rules exist to prevent — so the door is tested as
 * carefully as the ranking is.
 */
import type { ShareIntent } from 'expo-share-intent'
import { describe, expect, test } from 'vitest'

import { dropBody, dropFromShareIntent, dropTitle } from './drop'

const intent = (partial: Partial<ShareIntent>): ShareIntent => ({
  files: null,
  type: null,
  webUrl: null,
  text: null,
  meta: null,
  ...partial,
})

describe('what arrives from the share sheet', () => {
  test('a shared page is a link, with its host read off it', () => {
    expect(
      dropFromShareIntent(
        intent({
          type: 'weburl',
          webUrl: 'https://www.leukerecepten.nl/recepten/pasta/',
          meta: { title: 'Pasta' },
        }),
      ),
    ).toEqual({
      kind: 'url',
      url: 'https://www.leukerecepten.nl/recepten/pasta/',
      host: 'leukerecepten.nl',
      title: 'Pasta',
    })
  })

  /**
   * Android shares a URL as text with no `webUrl` at all. Believing the type
   * string would offer Notes for a page the importer could have read.
   */
  test('a link shared as text is still a link', () => {
    expect(
      dropFromShareIntent(
        intent({ type: 'text', text: '  https://example.com/x  ' }),
      ),
    ).toEqual({
      kind: 'url',
      url: 'https://example.com/x',
      host: 'example.com',
      title: undefined,
    })
  })

  /**
   * Only when the extractor found nothing. A share that really is a sentence
   * with a link in it arrives with `webUrl` filled in by the native module, and
   * the case above already says the link wins there.
   */
  test('a sentence with no extracted link stays text', () => {
    const drop = dropFromShareIntent(
      intent({ type: 'text', text: 'look at https://example.com/x' }),
    )
    expect(drop).toEqual({
      kind: 'text',
      text: 'look at https://example.com/x',
    })
  })

  test('something that is not a URL at all stays text', () => {
    expect(
      dropFromShareIntent(intent({ type: 'text', text: 'stroopwafels' })),
    ).toEqual({ kind: 'text', text: 'stroopwafels' })
  })

  test('a photo is a local file path and its type', () => {
    expect(
      dropFromShareIntent(
        intent({
          type: 'media',
          files: [
            {
              fileName: 'IMG_1.jpg',
              mimeType: 'image/jpeg',
              path: 'file:///tmp/IMG_1.jpg',
              size: 10,
              width: 100,
              height: 100,
              duration: null,
            },
          ],
        }),
      ),
    ).toEqual({
      kind: 'image',
      uri: 'file:///tmp/IMG_1.jpg',
      mimeType: 'image/jpeg',
    })
  })

  test('a shared file that is not an image is nothing Gather can place', () => {
    expect(
      dropFromShareIntent(
        intent({
          type: 'file',
          files: [
            {
              fileName: 'a.pdf',
              mimeType: 'application/pdf',
              path: 'file:///tmp/a.pdf',
              size: 10,
              width: null,
              height: null,
              duration: null,
            },
          ],
        }),
      ),
    ).toBeNull()
  })

  test('a link wins over an excerpt shared beside it', () => {
    const drop = dropFromShareIntent(
      intent({
        type: 'weburl',
        webUrl: 'https://example.com/x',
        text: 'an excerpt of the page',
      }),
    )
    expect(drop?.kind).toBe('url')
  })

  test('an empty share leaves nothing behind', () => {
    expect(dropFromShareIntent(intent({}))).toBeNull()
    expect(
      dropFromShareIntent(intent({ type: 'text', text: '   ' })),
    ).toBeNull()
  })
})

describe('turning shared text into something with a name', () => {
  test('the first line names it and the rest is the body', () => {
    expect(dropTitle('Buy stroopwafels\nthe thin ones')).toBe(
      'Buy stroopwafels',
    )
    expect(dropBody('Buy stroopwafels\nthe thin ones')).toBe('the thin ones')
  })

  test('leading blank lines do not become the title', () => {
    expect(dropTitle('\n\n  Real title\nbody')).toBe('Real title')
    expect(dropBody('\n\n  Real title\nbody')).toBe('body')
  })

  test('a single line has no body, so the note does not repeat itself', () => {
    expect(dropBody('Just this')).toBe('')
  })

  test('a whole article is cut down to something a list can show', () => {
    const long = 'x'.repeat(200)
    const title = dropTitle(long)
    expect(title).toHaveLength(80)
    expect(title.endsWith('…')).toBe(true)
  })
})
