// @vitest-environment jsdom
import { expect, test, vi } from 'vitest'

import { closeOpenSheets, openSheet } from '../../components/openSheets'
import { mount } from '../../testing/dom'
import { useFinanceWrite } from './useFinanceWrite'

vi.mock('../../feedback/haptics', () => ({
  haptics: { actionFailed: vi.fn() },
}))
vi.mock('../../i18n', () => ({
  useI18n: () => ({ t: { common: { errors: { didNotWork: '' } } } }),
}))
vi.mock('./ui', () => ({ StaleBanner: () => null }))

let hook: ReturnType<typeof useFinanceWrite>
function Screen() {
  hook = useFinanceWrite()
  return null
}

function deferred() {
  let resolve = () => {}
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

const flush = () => new Promise((done) => setTimeout(done, 0))

test('a save that lands closes its sheet', async () => {
  const view = mount(<Screen />)
  const close = vi.fn()
  const save = deferred()
  const started = vi.fn()
  const settled = vi.fn()
  hook.writes.onStart(started)
  hook.attempt(() => save.promise, close)
  expect(started).toHaveBeenCalledOnce()
  hook.writes.onSettled(settled)
  save.resolve()
  await flush()
  expect(close).toHaveBeenCalledOnce()
  expect(settled).toHaveBeenCalledWith(true)
  view.unmount()
})

test('a save that lands after a share closed its sheet does not close the next one', async () => {
  const view = mount(<Screen />)
  const close = vi.fn()
  const settled = vi.fn()
  const save = deferred()
  hook.attempt(() => save.promise, close)
  hook.writes.onSettled(settled)
  const sheet = openSheet(() => sheet.closed())
  await closeOpenSheets()
  save.resolve()
  await flush()
  expect(close).not.toHaveBeenCalled()
  expect(settled).toHaveBeenCalledWith(true)

  // The next save is its own.
  hook.attempt(() => Promise.resolve(), close)
  await flush()
  expect(close).toHaveBeenCalledOnce()
  view.unmount()
})
