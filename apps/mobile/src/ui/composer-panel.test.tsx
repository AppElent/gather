// @vitest-environment jsdom
/**
 * Kies datum… in a keyboard composer (APP-661): picking a day sets it and
 * closes the calendar; Done closes it unchanged. React Native and the native
 * picker are replaced: the picker is a button per day.
 */
import type { ReactNode } from 'react'
import { act } from 'react'
import { afterEach, expect, test, vi } from 'vitest'

import { mount } from '../testing/dom'
import { ComposerDatePanel } from './composer-panel'

const platform = vi.hoisted(() => ({ OS: 'ios' }))

vi.mock('react-native', async () => {
  const React = await import('react')
  type Props = { children?: ReactNode; testID?: string; onPress?: () => void }
  return {
    Platform: platform,
    View: ({ children }: Props) => React.createElement('div', null, children),
    Text: ({ children }: Props) => React.createElement('span', null, children),
    Pressable: ({ children, testID, onPress }: Props) =>
      React.createElement('button', { 'data-testid': testID, onClick: onPress }, children),
    StyleSheet: { create: <T,>(styles: T) => styles },
  }
})
vi.mock('../components/DateTimeField', async () => {
  const React = await import('react')
  return {
    // Android's dialog reports its close before the value, as the real one does.
    DateTimeWheel: ({
      onChange,
      onClose,
    }: {
      onChange: (next: Date) => void
      onClose: () => void
    }) =>
      React.createElement('button', {
        'data-testid': 'day-26',
        onClick: () => {
          if (platform.OS !== 'ios') onClose()
          onChange(new Date(2026, 10, 26, 12))
        },
      }),
  }
})
vi.mock('../i18n', async () => {
  const { en } = await import('../i18n/messages/en')
  return { useI18n: () => ({ t: en, locale: 'en' }) }
})
vi.mock('../theme/tokens', () => ({ TYPE: {}, useTokens: () => ({}) }))

let view: ReturnType<typeof mount> | undefined
afterEach(() => {
  view?.unmount()
  view = undefined
  platform.OS = 'ios'
})

function open() {
  const onPick = vi.fn()
  const onClose = vi.fn()
  view = mount(
    <ComposerDatePanel
      testID="done"
      value={new Date(2026, 10, 23, 12)}
      onPick={onPick}
      onClose={onClose}
    />,
  )
  const press = (id: string) =>
    act(() => view?.container.querySelector<HTMLElement>(`[data-testid="${id}"]`)?.click())
  return { onPick, onClose, press }
}

test('picking a day sets it and closes the calendar', () => {
  const { onPick, onClose, press } = open()
  press('day-26')
  expect(onPick).toHaveBeenCalledWith(new Date(2026, 10, 26, 12))
  expect(onClose).toHaveBeenCalledTimes(1)
})

test('Done closes the calendar without picking', () => {
  const { onPick, onClose, press } = open()
  press('done')
  expect(onPick).not.toHaveBeenCalled()
  expect(onClose).toHaveBeenCalledTimes(1)
})

test("on Android the dialog's own close is the only one", () => {
  platform.OS = 'android'
  const { onPick, onClose, press } = open()
  press('day-26')
  expect(onPick).toHaveBeenCalledTimes(1)
  expect(onClose).toHaveBeenCalledTimes(1)
})
