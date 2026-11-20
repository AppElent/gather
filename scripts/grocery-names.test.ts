import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { curatedNames, namesModule } from './groceries/names'

const root = path.resolve(__dirname, '..')

describe('grocery names (APP-311)', () => {
  it('names.generated.ts is curated.txt as built by build-names.ts', () => {
    const text = fs.readFileSync(
      path.join(root, 'scripts/groceries/curated.txt'),
      'utf8',
    )
    const generated = fs.readFileSync(
      path.join(root, 'packages/core/src/groceries/data/names.generated.ts'),
      'utf8',
    )
    expect(generated).toBe(namesModule(curatedNames(text)))
  })

  it('keeps the first name per key and skips drop lines', () => {
    expect(
      curatedNames(
        [
          '# comment',
          'dairy: melk, Melk, halfvolle melk',
          'produce: ui, uien',
          'drop: bel',
        ].join('\n'),
      ),
    ).toEqual({ produce: 'ui', dairy: 'melk|halfvolle melk' })
  })
})
