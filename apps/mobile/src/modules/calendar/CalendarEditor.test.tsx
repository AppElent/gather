// @vitest-environment jsdom
/**
 * The event editor drawn as a card closes the way a sheet does when a link, a
 * notification or a share leaves its screen, so what was typed is kept
 * (APP-817). Expanded, it is a sheet and registers itself.
 */
import { createElement } from 'react'
import { expect, test, vi } from 'vitest'

import { closeOpenSheets, hasOpenSheets } from '../../components/openSheets'
import { mount } from '../../testing/dom'
import { CalendarEditor } from './CalendarEditor'

vi.mock('../../feedback/confirmDestructive', () => ({
  confirmDestructive: () => {},
}))
vi.mock('../../i18n', () => ({
  fmt: (text: string) => text,
  useI18n: () => ({
    t: { calendar: {}, common: { actions: {} } },
  }),
}))
vi.mock('./CalendarEditorCard', () => ({ CalendarEditorCard: () => null }))
vi.mock('./CalendarEditorSheet', () => ({ CalendarEditorSheet: () => null }))
vi.mock('./calendarDraft', () => ({ validateDraft: () => ({}) }))

function editor(presentation: 'card' | 'sheet', draft: object | null) {
  const controller = {
    draft,
    presentation,
    dismiss: vi.fn(),
    changeField: vi.fn(),
    save: vi.fn(),
    expand: vi.fn(),
    duplicate: vi.fn(),
    delete: vi.fn(),
  }
  const onClose = vi.fn()
  const element = createElement(CalendarEditor, {
    controller,
    people: [],
    calendars: [],
    onClose,
  } as never)
  return { controller, onClose, element }
}

test('a card is closed like its Close, dismissing its draft', async () => {
  const { controller, onClose, element } = editor('card', {
    values: { title: 'Dentist' },
  })
  const view = mount(element)
  expect(hasOpenSheets()).toBe(true)
  const closed = closeOpenSheets()
  expect(controller.dismiss).toHaveBeenCalledOnce()
  expect(onClose).toHaveBeenCalledOnce()
  view.unmount()
  await closed
  expect(hasOpenSheets()).toBe(false)
})

test('a sheet does not register twice, and no draft registers nothing', () => {
  const sheet = editor('sheet', { values: { title: 'Dentist' } })
  const view = mount(sheet.element)
  expect(hasOpenSheets()).toBe(false)
  view.unmount()

  const none = editor('card', null)
  const empty = mount(none.element)
  expect(hasOpenSheets()).toBe(false)
  empty.unmount()
})

test('a card that is gone is no longer listed', () => {
  const { element } = editor('card', { values: { title: 'Dentist' } })
  const view = mount(element)
  view.unmount()
  expect(hasOpenSheets()).toBe(false)
})
