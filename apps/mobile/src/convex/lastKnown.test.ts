import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  offlineCards,
  offlineGroupCard,
  offlineGroupCards,
} from '../features/loyalty-cards/offline/offline-cards'
import {
  clearLastKnown,
  confirmAccount,
  confirmedAccount,
  diskScope,
  entryKey,
  MAX_ENTRIES,
  MAX_VALUE_LENGTH,
  readEntry,
  readOfflineEntries,
  setStoreForTests,
  writeEntry,
} from './lastKnown'
import { DRAWN_CARD_FIELDS, PERSISTED } from './queries'

/** An in-memory stand-in for `expo-sqlite/kv-store`'s synchronous API. */
function fakeStore() {
  const map = new Map<string, string>()
  let broken = false
  const guard = () => {
    if (broken) throw new Error('storage is broken')
  }
  return {
    map,
    breakIt: () => {
      broken = true
    },
    api: {
      getItemSync: (key: string) => {
        guard()
        return map.get(key) ?? null
      },
      setItemSync: (key: string, value: string) => {
        guard()
        map.set(key, value)
      },
      removeItemSync: (key: string) => {
        guard()
        map.delete(key)
      },
      getAllKeysSync: () => {
        guard()
        return [...map.keys()]
      },
    },
  }
}

const card = {
  _id: 'k1',
  storeName: 'Albert Heijn',
  catalogKey: 'albert-heijn',
  brandColor: '#00a0e2',
  domain: 'ah.nl',
  cardNumber: '2620000000002',
  barcodeFormat: 'EAN_13',
  holder: 'Eric',
  note: 'kitchen drawer',
  lastUsedAt: 1_700_000_000_000,
  hasPhotos: true,
}

let store: ReturnType<typeof fakeStore>
beforeEach(() => {
  store = fakeStore()
  setStoreForTests(store.api as never)
})
afterEach(() => setStoreForTests(undefined))

function saveList(account: string, groupSlug: string, cards: unknown[]) {
  const key = entryKey(diskScope(account), 'loyaltyCards:list', { groupSlug })
  writeEntry(key as string, PERSISTED['loyaltyCards:list'](cards as never))
}

describe('the persisted shape', () => {
  it('keeps only what the card screen draws: no photos, note or usage', () => {
    const [kept] = PERSISTED['loyaltyCards:list']([card]) as Record<string, unknown>[]
    expect(Object.keys(kept).sort()).toEqual([...DRAWN_CARD_FIELDS].sort())
  })

  it('persists only the list: never the photo-carrying get, or search', () => {
    expect(Object.keys(PERSISTED)).toEqual(['loyaltyCards:list'])
  })
})

describe('the last-known copy', () => {
  it('round-trips Convex values, bigint included', () => {
    const key = entryKey(diskScope('user_a'), 'x:y', { n: 1n }) as string
    writeEntry(key, { n: 5n, list: [1, 'two'] })
    expect(readEntry(key)).toEqual({ n: 5n, list: [1, 'two'] })
  })

  it('reads a corrupt value as a miss', () => {
    store.map.set('qc|corrupt', '{not json')
    expect(readEntry('qc|corrupt')).toBeUndefined()
  })

  it('treats a store that throws as a miss, without throwing', () => {
    store.breakIt()
    expect(() => writeEntry('qc|k', 1)).not.toThrow()
    expect(readEntry('qc|k')).toBeUndefined()
    expect(() => confirmAccount('user_a')).not.toThrow()
    expect(confirmedAccount()).toBeNull()
    expect(() => clearLastKnown()).not.toThrow()
    expect(offlineCards('user_a')).toEqual([])
  })

  it('skips an oversized value', () => {
    writeEntry('qc|big', 'x'.repeat(MAX_VALUE_LENGTH + 1))
    expect(store.map.has('qc|big')).toBe(false)
  })

  it('keeps the entry count bounded, and the marker with it', () => {
    confirmAccount('user_a')
    for (let i = 0; i < MAX_ENTRIES + 10; i++) writeEntry(`qc|e${i}`, i)
    const entries = [...store.map.keys()].filter((k) => k.startsWith('qc|e'))
    expect(entries.length).toBe(MAX_ENTRIES)
    expect(confirmedAccount()).toBe('user_a')
  })

  it('leaves other keys in the store alone', () => {
    store.map.set('gather:locale', 'nl')
    confirmAccount('user_a')
    clearLastKnown()
    expect(store.map.get('gather:locale')).toBe('nl')
  })
})

describe('the offline-readable copy', () => {
  it('shows the confirmed account its saved cards', () => {
    saveList('user_a', 'home', [card])
    confirmAccount('user_a')
    expect(offlineCards('user_a')).toEqual([
      {
        _id: 'k1',
        storeName: 'Albert Heijn',
        catalogKey: 'albert-heijn',
        brandColor: '#00a0e2',
        cardNumber: '2620000000002',
        barcodeFormat: 'EAN_13',
        holder: 'Eric',
      },
    ])
  })

  it('shows nothing before Convex has confirmed an account here', () => {
    saveList('user_a', 'home', [card])
    expect(offlineCards('user_a')).toEqual([])
  })

  it('shows nothing to an account other than the one Convex confirmed', () => {
    saveList('user_a', 'home', [card])
    confirmAccount('user_a')
    expect(offlineCards('user_b')).toEqual([])
    expect(offlineCards(null)).toEqual([])
    expect(offlineCards(undefined)).toEqual([])
  })

  it('confirming another account deletes the previous account’s copy', () => {
    saveList('user_a', 'home', [card])
    confirmAccount('user_a')
    confirmAccount('user_b')
    expect(readOfflineEntries('user_a', 'loyaltyCards:list')).toEqual([])
    expect([...store.map.keys()].some((k) => k.includes('user_a'))).toBe(false)
  })

  it('never reads a copy written by another bundle', () => {
    const old = entryKey(
      diskScope('user_a', 'old-runtime+old-update'),
      'loyaltyCards:list',
      { groupSlug: 'home' },
    ) as string
    writeEntry(old, [card] as never)
    store.map.set('qc|confirmed-account', 'user_a')
    expect(offlineCards('user_a')).toEqual([])
    confirmAccount('user_a')
    expect(store.map.has(old)).toBe(false)
  })

  it('sign-out deletes every entry and the marker', () => {
    saveList('user_a', 'home', [card])
    confirmAccount('user_a')
    clearLastKnown()
    expect(confirmedAccount()).toBeNull()
    expect([...store.map.keys()]).toEqual([])
    expect(offlineCards('user_a')).toEqual([])
  })

  it('drops cards it could not draw instead of throwing', () => {
    saveList('user_a', 'home', [
      card,
      { ...card, _id: 'k2', barcodeFormat: 'not-a-format' },
      { ...card, _id: 'k3', cardNumber: 42 },
      null,
    ])
    confirmAccount('user_a')
    expect(offlineCards('user_a').map((c) => c._id)).toEqual(['k1'])
  })

  it('merges the Groups this account opened, once per card', () => {
    saveList('user_a', 'home', [card])
    saveList('user_a', 'parents', [card, { ...card, _id: 'k2', storeName: 'HEMA' }])
    confirmAccount('user_a')
    expect(offlineCards('user_a').map((c) => c._id).sort()).toEqual(['k1', 'k2'])
  })
})

describe('one Group’s offline copy (APP-206)', () => {
  const other = { ...card, _id: 'k2', storeName: 'Jumbo' }

  it('reads only the Group asked for, in the saved order', () => {
    saveList('user_a', 'home', [other, card])
    saveList('user_a', 'work', [{ ...card, _id: 'k9' }])
    confirmAccount('user_a')
    expect(offlineGroupCards('user_a', 'home')?.map((c) => c._id)).toEqual([
      'k2',
      'k1',
    ])
  })

  it('tells a Group with no copy from a copy with no cards', () => {
    saveList('user_a', 'empty', [])
    confirmAccount('user_a')
    expect(offlineGroupCards('user_a', 'empty')).toEqual([])
    expect(offlineGroupCards('user_a', 'never-opened')).toBeUndefined()
  })

  it('keeps the confirmed-account rule', () => {
    saveList('user_a', 'home', [card])
    expect(offlineGroupCards('user_a', 'home')).toBeUndefined()
    confirmAccount('user_a')
    expect(offlineGroupCards('user_b', 'home')).toBeUndefined()
    expect(offlineGroupCards(null, 'home')).toBeUndefined()
  })

  it('reads a broken store as a miss', () => {
    saveList('user_a', 'home', [card])
    confirmAccount('user_a')
    store.breakIt()
    expect(offlineGroupCards('user_a', 'home')).toBeUndefined()
  })

  it('reads a copy with no drawable card as a miss, not as empty', () => {
    saveList('user_a', 'home', [{ _id: 'k3', storeName: 'Kapot' }])
    confirmAccount('user_a')
    expect(offlineGroupCards('user_a', 'home')).toBeUndefined()
  })

  it('finds one saved card of the Group for its screen', () => {
    saveList('user_a', 'home', [other, card])
    saveList('user_a', 'work', [{ ...card, _id: 'k9' }])
    confirmAccount('user_a')
    expect(offlineGroupCard('user_a', 'home', 'k1')?.cardNumber).toBe(
      card.cardNumber,
    )
    expect(offlineGroupCard('user_a', 'home', 'k9')).toBeUndefined()
    expect(offlineGroupCard('user_b', 'home', 'k1')).toBeUndefined()
  })
})
