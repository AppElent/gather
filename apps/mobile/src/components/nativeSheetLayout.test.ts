import { expect, test } from 'vitest'

import { nativeSheetLayout } from './nativeSheetLayout'

test('gives iOS a little more header space and a bounded keyboard-safe body', () => {
  expect(nativeSheetLayout('ios')).toEqual({ fill: true, paddingTop: 8 })
})

test('keeps Android at its current dynamic layout', () => {
  expect(nativeSheetLayout('android')).toEqual({ fill: false, paddingTop: 0 })
})
