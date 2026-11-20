// @vitest-environment jsdom
import { expect, test, vi } from 'vitest'

import { mount, settle } from '../../../testing/dom'
import { useGiveWayWhenGone } from './use-give-way-when-gone'

function Screen({
  openedByControl,
  face,
  giveWay,
}: {
  openedByControl: boolean
  face: object | null | undefined
  giveWay: () => void
}) {
  useGiveWayWhenGone(openedByControl, face, giveWay)
  return null
}

const card = { storeName: 'Jumbo' }

test('a card the control opened that is gone gives way to the sheet, once', async () => {
  const giveWay = vi.fn()
  const view = mount(
    <Screen openedByControl face={undefined} giveWay={giveWay} />,
  )
  await settle()
  expect(giveWay).not.toHaveBeenCalled()

  view.rerender(<Screen openedByControl face={null} giveWay={giveWay} />)
  await settle()
  view.rerender(<Screen openedByControl face={null} giveWay={giveWay} />)
  await settle()
  expect(giveWay).toHaveBeenCalledTimes(1)
  view.unmount()
})

test('a card the control opened and then deleted does not give way', async () => {
  const giveWay = vi.fn()
  const view = mount(<Screen openedByControl face={card} giveWay={giveWay} />)
  await settle()

  // Deleted here (onDeleted goes back) or on another phone.
  view.rerender(<Screen openedByControl face={null} giveWay={giveWay} />)
  await settle()
  expect(giveWay).not.toHaveBeenCalled()
  view.unmount()
})

test('a card opened any other way never gives way', async () => {
  const giveWay = vi.fn()
  const view = mount(
    <Screen openedByControl={false} face={null} giveWay={giveWay} />,
  )
  await settle()
  expect(giveWay).not.toHaveBeenCalled()
  view.unmount()
})
