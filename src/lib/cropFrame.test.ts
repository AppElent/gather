import { describe, expect, test } from 'vitest'
import {
  cropFraction,
  initialCrop,
  moveCrop,
  resizeCrop,
  scaleCrop,
} from './cropFrame'

/**
 * A phone photo, the shape every one of these cases is really about.
 */
const PHONE = { width: 4032, height: 3024 }

describe('initialCrop', () => {
  test('a free frame encloses the whole image, so confirming crops nothing', () => {
    expect(initialCrop(PHONE, null)).toEqual({
      x: 0,
      y: 0,
      width: 4032,
      height: 3024,
    })
  })

  test('a locked frame is the largest that fits, centred', () => {
    expect(initialCrop(PHONE, 1)).toEqual({
      x: 504,
      y: 0,
      width: 3024,
      height: 3024,
    })
  })

  test('a locked frame on a portrait photo is bounded by the width', () => {
    expect(initialCrop({ width: 3024, height: 4032 }, 1)).toEqual({
      x: 0,
      y: 504,
      width: 3024,
      height: 3024,
    })
  })
})

describe('moveCrop', () => {
  test('slides the frame by a delta in source pixels', () => {
    const crop = initialCrop(PHONE, 1)
    expect(moveCrop(crop, PHONE, -200, 0)).toMatchObject({ x: 304, y: 0 })
  })

  test('stops at the edges rather than leaving the image', () => {
    const crop = initialCrop(PHONE, 1)
    expect(moveCrop(crop, PHONE, -9000, -9000)).toMatchObject({ x: 0, y: 0 })
    expect(moveCrop(crop, PHONE, 9000, 9000)).toMatchObject({ x: 1008, y: 0 })
  })

  test('never changes the frame size', () => {
    const crop = initialCrop(PHONE, 1)
    const moved = moveCrop(crop, PHONE, 9000, 9000)
    expect(moved.width).toBe(crop.width)
    expect(moved.height).toBe(crop.height)
  })
})

describe('resizeCrop', () => {
  test('a free frame follows both axes independently', () => {
    const crop = { x: 0, y: 0, width: 1000, height: 800 }
    expect(resizeCrop(crop, PHONE, null, -300, -100)).toMatchObject({
      width: 700,
      height: 700,
    })
  })

  test('a locked frame stays square whichever axis is dragged', () => {
    const crop = { x: 0, y: 0, width: 1000, height: 1000 }
    expect(resizeCrop(crop, PHONE, 1, -400, 0)).toMatchObject({
      width: 600,
      height: 600,
    })
    expect(resizeCrop(crop, PHONE, 1, 0, -400)).toMatchObject({
      width: 600,
      height: 600,
    })
  })

  test('a locked frame stays square when it runs out of image', () => {
    // Room to the right (4032) far exceeds room below (1024): clamping each
    // axis on its own would give a 4032x1024 "square".
    const crop = { x: 0, y: 2000, width: 1000, height: 1000 }
    const resized = resizeCrop(crop, PHONE, 1, 9000, 9000)
    expect(resized.width).toBe(resized.height)
    expect(resized.width).toBe(1024)
  })

  test('a frame cannot be shrunk to nothing', () => {
    const crop = { x: 0, y: 0, width: 1000, height: 1000 }
    expect(resizeCrop(crop, PHONE, 1, -9000, -9000).width).toBe(32)
    expect(resizeCrop(crop, PHONE, null, -9000, -9000)).toMatchObject({
      width: 32,
      height: 32,
    })
  })

  test('a tiny image is allowed to be smaller than the minimum frame', () => {
    const tiny = { width: 20, height: 20 }
    const crop = { x: 0, y: 0, width: 20, height: 20 }
    expect(resizeCrop(crop, tiny, 1, -9000, -9000)).toMatchObject({
      width: 20,
      height: 20,
    })
  })

  test('the frame stays inside the image', () => {
    const crop = { x: 3000, y: 2000, width: 500, height: 500 }
    const resized = resizeCrop(crop, PHONE, 1, 9000, 9000)
    expect(resized.x + resized.width).toBeLessThanOrEqual(PHONE.width)
    expect(resized.y + resized.height).toBeLessThanOrEqual(PHONE.height)
  })
})

describe('scaleCrop', () => {
  test('sizes the frame to a fraction of the largest that fits', () => {
    const crop = initialCrop(PHONE, 1)
    expect(scaleCrop(crop, PHONE, 1, 0.5)).toMatchObject({
      width: 1512,
      height: 1512,
    })
  })

  test('keeps the frame centred where it was', () => {
    const crop = { x: 1000, y: 1000, width: 1000, height: 1000 }
    const scaled = scaleCrop(crop, PHONE, 1, 0.2)
    // Within a pixel: an odd-width frame has its centre on a half-pixel.
    expect(Math.abs(scaled.x + scaled.width / 2 - 1500)).toBeLessThanOrEqual(1)
    expect(Math.abs(scaled.y + scaled.height / 2 - 1500)).toBeLessThanOrEqual(1)
  })

  test('pushes the frame back inside the image rather than overhanging', () => {
    const crop = { x: 3800, y: 2900, width: 200, height: 200 }
    const scaled = scaleCrop(crop, PHONE, 1, 1)
    expect(scaled.x + scaled.width).toBeLessThanOrEqual(PHONE.width)
    expect(scaled.y + scaled.height).toBeLessThanOrEqual(PHONE.height)
  })

  test('a free frame scales on its own ratio', () => {
    const crop = initialCrop(PHONE, null)
    const scaled = scaleCrop(crop, PHONE, null, 0.5)
    expect(scaled).toMatchObject({ width: 2016, height: 1512 })
  })

  test('is the inverse of cropFraction', () => {
    const crop = initialCrop(PHONE, 1)
    expect(cropFraction(crop, PHONE, 1)).toBe(1)
    expect(cropFraction(scaleCrop(crop, PHONE, 1, 0.4), PHONE, 1)).toBeCloseTo(
      0.4,
      3,
    )
  })
})

describe('a locked aspect survives every path', () => {
  test.each([
    2160, 2161, 3023, 3024, 4031,
  ])('an image %ipx tall still frames an exact square', (height) => {
    const image = { width: 4031, height }
    let crop = initialCrop(image, 1)
    expect(crop.width).toBe(crop.height)
    crop = scaleCrop(crop, image, 1, 0.333)
    expect(crop.width).toBe(crop.height)
    crop = moveCrop(crop, image, 777, 777)
    expect(crop.width).toBe(crop.height)
    crop = resizeCrop(crop, image, 1, 555, 111)
    expect(crop.width).toBe(crop.height)
    expect(crop.x + crop.width).toBeLessThanOrEqual(image.width)
    expect(crop.y + crop.height).toBeLessThanOrEqual(image.height)
  })
})
