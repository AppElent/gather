// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'

import { closeOpenSheets, openSheet } from '../components/openSheets'
import { mount } from '../testing/dom'
import { draftKey, forgetDrafts, keepDraft, keptDraft } from './composer-drafts'
import {
  type SheetDraft,
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

function Screen({
  open,
  onResume,
}: {
  open: string | null
  onResume: (resume: () => string | undefined) => void
}) {
  onResume(useSheetResume(open))
  return null
}

test('a screen resumes the sheet a share closed, once', async () => {
  let resume: () => string | undefined = () => undefined
  const grab = (fn: typeof resume) => {
    resume = fn
  }
  const view = mount(<Screen open="saved" onResume={grab} />)
  const sheet = openSheet(() => sheet.closed())
  await closeOpenSheets()
  view.rerender(<Screen open={null} onResume={grab} />)

  expect(resume()).toBe('saved')
  // Asked by the open it answered: gone for the next one.
  expect(resume()).toBeUndefined()
  view.unmount()
})

test('a screen whose sheet was closed resumes nothing', async () => {
  let resume: () => string | undefined = () => 'stale'
  const view = mount(
    <Screen
      open={null}
      onResume={(fn) => {
        resume = fn
      }}
    />,
  )
  const sheet = openSheet(() => sheet.closed())
  await closeOpenSheets()
  expect(resume()).toBeUndefined()
  view.unmount()
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

test('a save that lands after the close makes the kept input old', async () => {
  const landed = { current: 0 }
  let resume: () => string | undefined = () => undefined
  function Saving({ open }: { open: string | null }) {
    resume = useSheetResume(open, landed)
    return null
  }
  const view = mount(<Saving open="saved" />)
  const sheet = openSheet(() => sheet.closed())
  await closeOpenSheets()
  view.rerender(<Saving open={null} />)
  landed.current += 1
  expect(resume()).toBeUndefined()
  view.unmount()
})

test('a sheet closed later does not make a screen forget its own', async () => {
  let resume: () => string | undefined = () => undefined
  const grab = (fn: typeof resume) => {
    resume = fn
  }
  const view = mount(<Screen open="saved" onResume={grab} />)
  const first = openSheet(() => first.closed())
  await closeOpenSheets()
  view.rerender(<Screen open={null} onResume={grab} />)
  const second = openSheet(() => second.closed())
  await closeOpenSheets()
  expect(resume()).toBe('saved')
  view.unmount()
})
