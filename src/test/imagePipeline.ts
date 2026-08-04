import { type Mock, vi } from 'vitest'

/**
 * The browser's image pipeline, stood in for.
 *
 * jsdom has no `createImageBitmap` and no 2D canvas, so every test that touches
 * preparing a photo has to supply both. There is one copy of that here because
 * there were briefly three, and they had already drifted into disagreeing about
 * what `toBlob` hands back when asked for a type — which is the precise defect
 * the real code refuses to ship (`preparePhoto` rejects anything that is not a
 * JPEG), and so the precise thing a stub must not get quietly wrong. The same
 * lesson `src/lib/errorMessage.ts` records about its own three copies.
 *
 * The default behaviour is a browser that does what it is asked: it decodes to
 * the size given, and encodes to the type requested.
 */

export interface StubbedImagePipeline {
  /** The 2D context's `drawImage`, for asserting what region was drawn. */
  drawImage: Mock
  toBlob: Mock
  /** What `createImageBitmap` was called with, most recent call last. */
  createImageBitmap: Mock
  /** The crop region handed to `drawImage`, in source pixels. */
  drawnRegion: () => { x: number; y: number; width: number; height: number }
  /** Make the encoder hand back something else — a PNG, or nothing at all. */
  encodesTo: (blob: Blob | null) => void
}

interface StubOptions {
  /** The upright size the image decodes to. */
  width?: number
  height?: number
  /** Replaces the decode entirely — throw from here to refuse the image. */
  decode?: () => Promise<{ width: number; height: number; close: () => void }>
  /** Bytes the encoder produces, so a test can tell prepared output apart. */
  contents?: string
}

export function stubImagePipeline({
  width = 4032,
  height = 3024,
  decode,
  contents = 'prepared jpeg',
}: StubOptions = {}): StubbedImagePipeline {
  const drawImage = vi.fn()
  const toBlob = vi.fn(
    (callback: (blob: Blob | null) => void, type?: string) => {
      callback(new Blob([contents], { type: type ?? '' }))
    },
  )
  const createImageBitmap = vi.fn(
    decode ?? (async () => ({ width, height, close: vi.fn() })),
  )

  vi.stubGlobal('createImageBitmap', createImageBitmap)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage,
  } as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(toBlob)

  return {
    drawImage,
    toBlob,
    createImageBitmap,
    drawnRegion: () => {
      const [, x, y, w, h] = drawImage.mock.calls[0] as number[]
      return { x, y, width: w, height: h }
    },
    encodesTo: (blob) => {
      toBlob.mockImplementation((callback: (b: Blob | null) => void) =>
        callback(blob),
      )
    },
  }
}
