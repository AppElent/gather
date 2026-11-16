/**
 * The two screen tops are the platform's own chrome: transparent bars, the
 * system large title on a wash, and on a photo record one visible title at a
 * time (Tiles & Today, `components/WashHeader` and `components/PhotoHeader`).
 */
import { describe, expect, test } from 'vitest'

import {
  inlineTitleShown,
  PHOTO_HEIGHT,
  pendingScreenOptions,
  photoScreenOptions,
  washScreenOptions,
} from './screen-header'

describe('washScreenOptions', () => {
  test('is a transparent bar with the native large title', () => {
    expect(washScreenOptions('Recipes')).toEqual({
      headerShown: true,
      title: 'Recipes',
      headerTransparent: true,
      headerLargeTitle: true,
      headerShadowVisible: false,
      headerLargeTitleShadowVisible: false,
    })
  })
})

describe('pendingScreenOptions', () => {
  test('is transparent already, so the header never switches mode under a mounted screen', () => {
    const options = pendingScreenOptions('Recipes')
    expect(options.title).toBe('Recipes')
    expect(options.headerTransparent).toBe(true)
    expect(options.headerLargeTitle).toBe(false)
  })
})

describe('photoScreenOptions', () => {
  test('keeps the title for VoiceOver but withholds its ink until scrolled', () => {
    const hidden = photoScreenOptions('Lasagne', false, '#111')
    expect(hidden.title).toBe('Lasagne')
    expect(hidden.headerTransparent).toBe(true)
    expect(hidden.headerLargeTitle).toBe(false)
    expect(hidden.headerTitleStyle.color).toBe('transparent')

    const shown = photoScreenOptions('Lasagne', true, '#111')
    expect(shown.headerTitleStyle).toEqual({ color: '#111' })
  })

  test('hides the top scroll-edge blur only while the photo is under the bar', () => {
    // Before layout the effect is the default, so hiding it is a change
    // react-native-screens applies to the mounted scroll view.
    expect(
      photoScreenOptions('Lasagne', false, '#111', false).scrollEdgeEffects
        .top,
    ).toBe('automatic')
    // The inline title needs the blur back to stay legible.
    expect(
      photoScreenOptions('Lasagne', true, '#111', true).scrollEdgeEffects.top,
    ).toBe('automatic')
    expect(
      photoScreenOptions('Lasagne', false, '#111', true).scrollEdgeEffects,
    ).toEqual({
      top: 'hidden',
      bottom: 'automatic',
      left: 'automatic',
      right: 'automatic',
    })
  })
})

describe('inlineTitleShown', () => {
  const barBottom = 103 // a 59 pt status bar and the 44 pt bar
  const titleBottom = PHOTO_HEIGHT + 80

  test('is false before the title has been measured', () => {
    expect(inlineTitleShown(500, null, barBottom)).toBe(false)
  })

  test('is false while the title is still below the bar', () => {
    expect(inlineTitleShown(0, titleBottom, barBottom)).toBe(false)
    expect(
      inlineTitleShown(titleBottom - barBottom - 1, titleBottom, barBottom),
    ).toBe(false)
  })

  test('is true once the title has gone under the bar', () => {
    expect(
      inlineTitleShown(titleBottom - barBottom, titleBottom, barBottom),
    ).toBe(true)
    expect(inlineTitleShown(1000, titleBottom, barBottom)).toBe(true)
  })
})
