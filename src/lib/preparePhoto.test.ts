import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  type StubbedImagePipeline,
  stubImagePipeline,
} from '../test/imagePipeline'
import { initialCrop } from './cropFrame'
import { photoPreset } from './photoPresets'
import {
  type DecodedPhoto,
  decodePhoto,
  outputSize,
  PHOTO_DECODE_ERROR,
  PHOTO_PREPARE_ERROR,
  preparePhoto,
} from './preparePhoto'

/**
 * jsdom has neither `createImageBitmap` nor a 2D canvas, which is the honest
 * situation: the pixels cannot be inspected here. What can be checked is every
 * instruction we hand the browser — that we ask for EXIF orientation to be
 * applied, that we ask for a JPEG at the preset's quality, that we draw the
 * region the person framed at the size the preset allows — plus that each way
 * this can fail ends in a refusal rather than in bytes.
 */

let pipeline: StubbedImagePipeline

/** The stand-in for whatever `createImageBitmap` would have returned. */
function decoded(width: number, height: number): DecodedPhoto {
  return { width, height, source: {} as CanvasImageSource, close: vi.fn() }
}

beforeEach(() => {
  pipeline = stubImagePipeline()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('decodePhoto', () => {
  test('asks for the EXIF orientation to be applied, so portraits stay upright', async () => {
    const createImageBitmap = vi
      .fn()
      .mockResolvedValue({ width: 3024, height: 4032, close: vi.fn() })
    vi.stubGlobal('createImageBitmap', createImageBitmap)

    const file = new Blob(['…'], { type: 'image/jpeg' })
    const photo = await decodePhoto(file)

    expect(createImageBitmap).toHaveBeenCalledWith(file, {
      imageOrientation: 'from-image',
    })
    // And the dimensions the person frames against are the upright ones.
    expect(photo).toMatchObject({ width: 3024, height: 4032 })
  })

  test('refuses an image the browser cannot decode', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockRejectedValue(new Error('unsupported')),
    )
    await expect(decodePhoto(new Blob(['heic']))).rejects.toThrow(
      PHOTO_DECODE_ERROR,
    )
  })

  test('refuses an image that decodes to nothing', async () => {
    const close = vi.fn()
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({ width: 0, height: 0, close }),
    )
    await expect(decodePhoto(new Blob(['x']))).rejects.toThrow(
      PHOTO_DECODE_ERROR,
    )
    expect(close).toHaveBeenCalled()
  })

  test('refuses where the browser cannot decode images at all', async () => {
    vi.stubGlobal('createImageBitmap', undefined)
    await expect(decodePhoto(new Blob(['x']))).rejects.toThrow(
      PHOTO_DECODE_ERROR,
    )
  })
})

describe('outputSize', () => {
  test('shrinks the longest edge to the limit and keeps the shape', () => {
    expect(outputSize({ width: 4032, height: 3024 }, 1600)).toEqual({
      width: 1600,
      height: 1200,
    })
    expect(outputSize({ width: 3024, height: 4032 }, 1600)).toEqual({
      width: 1200,
      height: 1600,
    })
  })

  test('a square frame stays square', () => {
    expect(outputSize({ width: 3024, height: 3024 }, 512)).toEqual({
      width: 512,
      height: 512,
    })
    expect(outputSize({ width: 3025, height: 3025 }, 512)).toEqual({
      width: 512,
      height: 512,
    })
  })

  test('never upscales a photo that is already small', () => {
    expect(outputSize({ width: 300, height: 200 }, 1600)).toEqual({
      width: 300,
      height: 200,
    })
  })

  test('never exceeds the limit, whatever the rounding', () => {
    for (const width of [1601, 1600, 1599, 4032, 33, 1]) {
      for (const height of [1601, 900, 4032, 7, 1]) {
        const size = outputSize({ width, height }, 1600)
        expect(Math.max(size.width, size.height)).toBeLessThanOrEqual(1600)
        expect(Math.min(size.width, size.height)).toBeGreaterThanOrEqual(1)
      }
    }
  })
})

describe('preparePhoto', () => {
  test("a child's photo is stored as a square JPEG no larger than 512", async () => {
    const image = { width: 4032, height: 3024 }
    const photo = decoded(image.width, image.height)
    const preset = photoPreset('childPhoto')

    const prepared = await preparePhoto(
      photo,
      initialCrop(image, preset.aspect),
      preset,
    )

    expect(prepared).toMatchObject({ width: 512, height: 512 })
    expect(prepared.blob.type).toBe('image/jpeg')
    expect(pipeline.toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      'image/jpeg',
      0.82,
    )
  })

  test('a recipe photo is stored with its longest edge at 1600', async () => {
    const image = { width: 4032, height: 3024 }
    const preset = photoPreset('recipePhoto')

    const prepared = await preparePhoto(
      decoded(image.width, image.height),
      initialCrop(image, preset.aspect),
      preset,
    )

    expect(prepared).toMatchObject({ width: 1600, height: 1200 })
  })

  test('draws the framed region, not the whole image', async () => {
    const photo = decoded(4032, 3024)
    await preparePhoto(
      photo,
      { x: 504, y: 0, width: 3024, height: 3024 },
      photoPreset('childPhoto'),
    )

    expect(pipeline.drawImage).toHaveBeenCalledWith(
      photo.source,
      504,
      0,
      3024,
      3024,
      0,
      0,
      512,
      512,
    )
  })

  test('refuses rather than uploading a PNG that toBlob substituted', async () => {
    pipeline.encodesTo(new Blob(['png'], { type: 'image/png' }))
    await expect(
      preparePhoto(
        decoded(800, 600),
        { x: 0, y: 0, width: 800, height: 600 },
        photoPreset('recipePhoto'),
      ),
    ).rejects.toThrow(PHOTO_PREPARE_ERROR)
  })

  test('refuses when the encode produces nothing', async () => {
    pipeline.encodesTo(null)
    await expect(
      preparePhoto(
        decoded(800, 600),
        { x: 0, y: 0, width: 800, height: 600 },
        photoPreset('recipePhoto'),
      ),
    ).rejects.toThrow(PHOTO_PREPARE_ERROR)
  })

  test('refuses when the drawing surface is unavailable', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    await expect(
      preparePhoto(
        decoded(800, 600),
        { x: 0, y: 0, width: 800, height: 600 },
        photoPreset('recipePhoto'),
      ),
    ).rejects.toThrow(PHOTO_PREPARE_ERROR)
  })

  test('refuses when drawing throws', async () => {
    pipeline.drawImage.mockImplementation(() => {
      throw new Error('out of memory')
    })
    await expect(
      preparePhoto(
        decoded(800, 600),
        { x: 0, y: 0, width: 800, height: 600 },
        photoPreset('recipePhoto'),
      ),
    ).rejects.toThrow(PHOTO_PREPARE_ERROR)
  })
})
