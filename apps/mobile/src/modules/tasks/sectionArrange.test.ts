import { describe, expect, it } from 'vitest'
import {
  arrangementOf,
  committed,
  firstDropIndex,
  headingKey,
  headingSection,
} from './sectionArrange'

const sections = [
  { id: 'kitchen', name: 'Kitchen' },
  { id: 'bath', name: 'Bathroom' },
]

describe('reorder across sections', () => {
  it('is the plain task order on a list without sections', () => {
    const order = arrangementOf([], [{ id: 'a' }, { id: 'b', sectionId: 'x' }])
    expect(order).toEqual(['a', 'b'])
    expect(firstDropIndex(order)).toBe(0)
    expect(committed(order)).toEqual({ ids: ['a', 'b'] })
  })

  it('opens with No section first, then each section in order', () => {
    const order = arrangementOf(sections, [
      { id: 'a', sectionId: 'bath' },
      { id: 'b' },
      { id: 'c', sectionId: 'kitchen' },
      { id: 'd', sectionId: 'deleted' },
    ])
    expect(order).toEqual([
      headingKey(null),
      'b',
      'd',
      headingKey('kitchen'),
      'c',
      headingKey('bath'),
      'a',
    ])
    expect(firstDropIndex(order)).toBe(1)
  })

  it('files each task under the nearest heading above it', () => {
    const order = [
      headingKey(null),
      headingKey('kitchen'),
      'a',
      'b',
      headingKey('bath'),
      'c',
    ]
    expect(committed(order)).toEqual({
      ids: ['a', 'b', 'c'],
      sectionIds: ['kitchen', 'kitchen', 'bath'],
    })
  })

  it('tells a heading from a task id', () => {
    expect(headingSection(headingKey(null))).toBeNull()
    expect(headingSection(headingKey('kitchen'))).toBe('kitchen')
    expect(headingSection('j97abc')).toBeUndefined()
  })
})
