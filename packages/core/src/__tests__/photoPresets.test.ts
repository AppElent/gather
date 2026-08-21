import { describe, expect, test } from 'vitest'
import { PHOTO_PRESETS, photoPreset } from '../photoPresets'

/**
 * The preset table is the only place a dimension or a quality is allowed to be
 * written down (ADR-0010), so these tests are about the shape of the table
 * rather than about arithmetic: three presets, the child's frame locked
 * square, the other two free.
 */
describe('photo presets', () => {
  test('each is named for where the photo is shown', () => {
    expect(Object.keys(PHOTO_PRESETS).sort()).toEqual([
      'childPhoto',
      'memoryPhoto',
      'recipePhoto',
    ])
  })

  test("a child's photo is a square no larger than 512px", () => {
    expect(photoPreset('childPhoto')).toEqual({
      aspect: 1,
      maxEdge: 512,
      quality: 0.82,
    })
  })

  test('a memory photo is freely framed, no larger than 1600px', () => {
    expect(photoPreset('memoryPhoto')).toEqual({
      aspect: null,
      maxEdge: 1600,
      quality: 0.82,
    })
  })

  test('a recipe photo is freely framed, no larger than 1600px', () => {
    expect(photoPreset('recipePhoto')).toEqual({
      aspect: null,
      maxEdge: 1600,
      quality: 0.82,
    })
  })

  test('every preset asks for a quality a JPEG encoder accepts', () => {
    for (const preset of Object.values(PHOTO_PRESETS)) {
      expect(preset.quality).toBeGreaterThan(0)
      expect(preset.quality).toBeLessThanOrEqual(1)
      expect(preset.maxEdge).toBeGreaterThan(0)
    }
  })
})
