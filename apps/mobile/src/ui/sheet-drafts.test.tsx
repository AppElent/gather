// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'

import { closeOpenSheets, openSheet } from '../components/openSheets'
import { mount } from '../testing/dom'
import { draftKey, forgetDrafts, keepDraft, keptDraft } from './composer-drafts'
import {
  type SheetDraft,
  type SheetWrites,
  type TrackOptions,
  useSheetDraft,
  useSheetResume,
} from './sheet-drafts'

const who = vi.hoisted(() => ({ userId: 'u1', groupId: 'g1' }))

vi.mock('@clerk/expo', () => ({ useAuth: () => ({ userId: who.userId }) }))
vi.mock('../group/GroupProvider', () => ({
  useGroup: () => ({ group: { _id: who.groupId } }),
}))

interface Draft {
  name: string
}

const KEY = draftKey('u1', 'g1', 'test:form')
let seen: SheetDraft<Draft> | undefined

function Form({ name, options }: { name: string; options?: TrackOptions }) {
  const draft = useSheetDraft<Draft>('test:form')
  seen = draft
  draft.track({ name }, options)
  return null
}

/** A sheet around the form, closed by a share the way `DropGate` does. */
async function share(view: ReturnType<typeof mount>) {
  const sheet = openSheet(() => {
    view.unmount()
    sheet.closed()
  })
  await closeOpenSheets()
}

afterEach(() => {
  forgetDrafts()
  seen = undefined
  who.userId = 'u1'
  who.groupId = 'g1'
})

test('a share keeps what was typed, and the form opens on it', async () => {
  const view = mount(<Form name="" />)
  view.rerender(<Form name="Kamperen" />)
  await share(view)
  expect(keptDraft(KEY)).toEqual({ name: 'Kamperen' })

  mount(<Form name="Kamperen" />).unmount()
  expect(seen?.kept).toEqual({ name: 'Kamperen' })
})

test('a close the person chose forgets the draft', () => {
  keepDraft(KEY, { name: 'Kamperen' })
  const view = mount(<Form name="Kamperen" />)
  expect(seen?.kept).toEqual({ name: 'Kamperen' })
  view.unmount()
  expect(keptDraft(KEY)).toBeUndefined()
})

test('an untouched form keeps nothing', async () => {
  const view = mount(<Form name="" />)
  await share(view)
  expect(keptDraft(KEY)).toBeUndefined()
})

test('a form opened on a draft keeps it through a second share', async () => {
  keepDraft(KEY, { name: 'Kamperen' })
  const view = mount(<Form name="Kamperen" />)
  await share(view)
  expect(keptDraft(KEY)).toEqual({ name: 'Kamperen' })
})

test('nothing is kept while a save is on its way', async () => {
  const view = mount(<Form name="" />)
  view.rerender(<Form name="Kamperen" options={{ holding: true }} />)
  await share(view)
  expect(keptDraft(KEY)).toBeUndefined()
})

test('an explicit dirty wins over the comparison', async () => {
  const view = mount(<Form name="" options={{ dirty: true }} />)
  await share(view)
  expect(keptDraft(KEY)).toEqual({ name: '' })
})

test('the draft belongs to its account and Group', async () => {
  const view = mount(<Form name="" />)
  view.rerender(<Form name="Kamperen" />)
  await share(view)

  who.groupId = 'g2'
  mount(<Form name="" />).unmount()
  expect(seen?.kept).toBeUndefined()

  who.groupId = 'g1'
  who.userId = 'u2'
  mount(<Form name="" />).unmount()
  expect(seen?.kept).toBeUndefined()
  expect(keptDraft(KEY)).toEqual({ name: 'Kamperen' })
})

test('the latest state is kept if the form closes after the share began', async () => {
  const view = mount(<Form name="" />)
  view.rerender(<Form name="Kamp" />)
  const sheet = openSheet(() => {})
  const closing = closeOpenSheets(10)
  view.rerender(<Form name="Kamperen" />)
  view.unmount()
  sheet.closed()
  await closing
  expect(keptDraft(KEY)).toEqual({ name: 'Kamperen' })
})

test('a save that fails after a share closed the form keeps it', async () => {
  const view = mount(<Form name="" />)
  view.rerender(<Form name="Kamperen" options={{ holding: true }} />)
  await share(view)
  seen?.failed()
  expect(keptDraft(KEY)).toEqual({ name: 'Kamperen' })

  // A newer draft stays.
  keepDraft(KEY, { name: 'Nieuw' })
  seen?.failed()
  expect(keptDraft(KEY)).toEqual({ name: 'Nieuw' })
})

test('a failed save in a form the person closed keeps nothing', () => {
  const view = mount(<Form name="Kamperen" />)
  view.unmount()
  seen?.failed()
  expect(keptDraft(KEY)).toBeUndefined()
})

test('a form a share closed is gone once unmounted, one closed by hand is not', async () => {
  const shared = mount(<Form name="Kamperen" />)
  const draft = seen
  expect(draft?.sharing()).toBe(false)
  const sheet = openSheet(() => {
    // Dismissed, and still mounted: a form that saves on close asks here.
    expect(draft?.sharing()).toBe(true)
    expect(draft?.gone()).toBe(false)
    shared.unmount()
    sheet.closed()
  })
  await closeOpenSheets()
  expect(draft?.gone()).toBe(true)

  mount(<Form name="Kamperen" />).unmount()
  expect(seen?.gone()).toBe(false)
})

test('an older form whose save fails late leaves a newer kept draft', async () => {
  const first = mount(<Form name="" />)
  first.rerender(<Form name="Eerst" options={{ holding: true }} />)
  await share(first)
  const older = seen

  const second = mount(<Form name="" />)
  second.rerender(<Form name="Daarna" />)
  await share(second)
  older?.failed()
  expect(keptDraft(KEY)).toEqual({ name: 'Daarna' })
})

let resume: (want: string) => boolean = () => false
const restored = vi.fn()

function Screen({
  open,
  value,
  writes,
}: {
  open: string | null
  value: string
  writes?: SheetWrites
}) {
  resume = useSheetResume({
    place: 'test:screen',
    open,
    values: value,
    restore: restored,
    writes,
  })
  return null
}

/** Opens `on` seeded with "1", types "2", and a share closes it. */
async function typeAndShare(writes?: SheetWrites, beforeShare?: () => void) {
  const view = mount(<Screen open={null} value="" writes={writes} />)
  view.rerender(<Screen open="saved" value="1" writes={writes} />)
  view.rerender(<Screen open="saved" value="2" writes={writes} />)
  beforeShare?.()
  const sheet = openSheet(() => sheet.closed())
  await closeOpenSheets()
  view.rerender(<Screen open={null} value="2" writes={writes} />)
  return view
}

function pendingWrites() {
  const listeners: ((landed: boolean) => void)[] = []
  const starts: (() => void)[] = []
  const writes: SheetWrites = {
    onStart: (listener) => {
      starts.push(listener)
      return () => {}
    },
    onSettled: (listener) => listeners.push(listener),
  }
  return {
    writes,
    start: () => {
      for (const listener of starts) listener()
    },
    settle: (landed: boolean) => {
      for (const listener of listeners) listener(landed)
    },
  }
}

test('a screen resumes what a share closed, once, and only there', async () => {
  restored.mockClear()
  const view = await typeAndShare()
  expect(resume('monthly')).toBe(false)
  expect(resume('saved')).toBe(true)
  expect(restored).toHaveBeenCalledWith('2')
  expect(resume('saved')).toBe(false)
  view.unmount()
})

test('a screen that unmounted resumes, in its own Group only', async () => {
  ;(await typeAndShare()).unmount()
  who.groupId = 'g2'
  const other = mount(<Screen open={null} value="" />)
  expect(resume('saved')).toBe(false)
  other.unmount()
  who.groupId = 'g1'
  const back = mount(<Screen open={null} value="" />)
  expect(resume('saved')).toBe(true)
  back.unmount()
})

test('an untouched screen sheet keeps nothing; a resumed one is kept again', async () => {
  const view = mount(<Screen open="saved" value="1" />)
  let sheet = openSheet(() => sheet.closed())
  await closeOpenSheets()
  expect(resume('saved')).toBe(false)
  view.unmount()

  const again = await typeAndShare()
  expect(resume('saved')).toBe(true)
  again.rerender(<Screen open="saved" value="2" />)
  sheet = openSheet(() => sheet.closed())
  await closeOpenSheets()
  expect(resume('saved')).toBe(true)
  again.unmount()
})

test('a later sheet does not make a screen forget its own', async () => {
  const view = await typeAndShare()
  const second = openSheet(() => second.closed())
  await closeOpenSheets()
  expect(resume('saved')).toBe(true)
  view.unmount()
})

test('a write on its way at the share is kept only if it fails, screen or no screen', async () => {
  const landed = pendingWrites()
  ;(await typeAndShare(landed.writes, landed.start)).unmount()
  landed.settle(true)
  const one = mount(<Screen open={null} value="" />)
  expect(resume('saved')).toBe(false)
  one.unmount()

  const failed = pendingWrites()
  ;(await typeAndShare(failed.writes, failed.start)).unmount()
  failed.settle(false)
  const two = mount(<Screen open={null} value="" />)
  expect(resume('saved')).toBe(true)
  two.unmount()
})

test("another sheet's save on its way does not take this one's draft with it", async () => {
  const other = pendingWrites()
  const view = mount(<Screen open="trade" value="a" writes={other.writes} />)
  other.start()
  view.rerender(<Screen open={null} value="a" writes={other.writes} />)
  view.rerender(<Screen open="price" value="1" writes={other.writes} />)
  view.rerender(<Screen open="price" value="2" writes={other.writes} />)
  const sheet = openSheet(() => sheet.closed())
  await closeOpenSheets()
  other.settle(true)
  expect(resume('price')).toBe(true)
  view.unmount()
})

test('what was typed after the save started is kept, even if it lands', async () => {
  const save = pendingWrites()
  const view = mount(<Screen open="saved" value="1" writes={save.writes} />)
  view.rerender(<Screen open="saved" value="2" writes={save.writes} />)
  save.start()
  view.rerender(<Screen open="saved" value="3" writes={save.writes} />)
  const sheet = openSheet(() => sheet.closed())
  await closeOpenSheets()
  save.settle(true)
  restored.mockClear()
  expect(resume('saved')).toBe(true)
  expect(restored).toHaveBeenCalledWith('3')
  view.unmount()
})
