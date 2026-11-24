// biome-ignore-all lint/correctness/useReactNativePlatformComponents: the test drives ActionSheetIOS, which the wrapper calls on iOS only.
/**
 * The OS presentations hold shake-to-report while they are up and release on
 * every way out (APP-439), ported from Foundry's `native-presentation.test.ts`.
 */
import * as Sentry from '@sentry/react-native'
import {
  requestCameraPermissionsAsync as nativeCameraPermission,
  launchCameraAsync as nativeLaunchCamera,
  launchImageLibraryAsync as nativeLaunchLibrary,
  requestMediaLibraryPermissionsAsync as nativeLibraryPermission,
} from 'expo-image-picker'
import { openBrowserAsync as nativeOpenBrowser } from 'expo-web-browser'
import { ActionSheetIOS, Alert, type AlertButton, Platform } from 'react-native'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { hasOpenPrompts } from '../components/openSheets'
import {
  launchCameraAsync,
  launchImageLibraryAsync,
  openBrowserAsync,
  requestCameraPermissionsAsync,
  requestMediaLibraryPermissionsAsync,
  showActionSheet,
  showAlert,
  showPrompt,
} from './native-presentation'
import {
  DISMISS_SETTLE_MS,
  resetShakeToReportForTests,
  startShakeToReport,
} from './shake-to-report'

vi.mock('@sentry/react-native', () => ({
  enableFeedbackOnShake: vi.fn(),
  disableFeedbackOnShake: vi.fn(),
}))
vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Alert: { alert: vi.fn(), prompt: vi.fn() },
  ActionSheetIOS: { showActionSheetWithOptions: vi.fn() },
}))
vi.mock('expo-web-browser', () => ({ openBrowserAsync: vi.fn() }))
vi.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: vi.fn(),
  launchCameraAsync: vi.fn(),
  requestCameraPermissionsAsync: vi.fn(),
  requestMediaLibraryPermissionsAsync: vi.fn(),
}))

const settle = () => vi.advanceTimersByTime(DISMISS_SETTLE_MS)
const paused = () => vi.mocked(Sentry.disableFeedbackOnShake)
const listening = () => vi.mocked(Sentry.enableFeedbackOnShake)

beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(Alert.alert).mockReset()
  vi.mocked(Alert.prompt).mockReset()
  vi.mocked(ActionSheetIOS.showActionSheetWithOptions).mockReset()
  resetShakeToReportForTests()
  startShakeToReport()
  paused().mockClear()
  listening().mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('showAlert', () => {
  function open(buttons?: AlertButton[], onDismiss?: () => void) {
    showAlert('Title', 'Body', buttons, { cancelable: true, onDismiss })
    const [, , shown, options] = vi.mocked(Alert.alert).mock.calls[0]
    return { shown: shown ?? [], options }
  }

  it('pauses shake while open and resumes after a button press settles', () => {
    const onPress = vi.fn()
    const { shown } = open([{ text: 'Delete', onPress }])
    expect(paused()).toHaveBeenCalledTimes(1)

    shown[0].onPress?.()
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(listening()).not.toHaveBeenCalled()
    settle()
    expect(listening()).toHaveBeenCalledTimes(1)
  })

  it('releases for the implicit OK button when no buttons are passed', () => {
    const { shown } = open()
    expect(shown).toHaveLength(1)
    shown[0].onPress?.()
    settle()
    expect(listening()).toHaveBeenCalledTimes(1)
  })

  it("releases on dismiss and still calls the caller's onDismiss", () => {
    const onDismiss = vi.fn()
    const { options } = open([{ text: 'OK' }], onDismiss)
    options?.onDismiss?.()
    expect(onDismiss).toHaveBeenCalledTimes(1)
    settle()
    expect(listening()).toHaveBeenCalledTimes(1)
  })

  it('releases once when both a button and dismiss fire', () => {
    const { shown, options } = open([{ text: 'OK' }])
    shown[0].onPress?.()
    options?.onDismiss?.()
    settle()
    expect(listening()).toHaveBeenCalledTimes(1)
  })

  it('holds a share only when asked to, until it is answered', () => {
    open([{ text: 'OK' }])
    expect(hasOpenPrompts()).toBe(false)
    vi.mocked(Alert.alert).mockClear()
    showAlert('Title', undefined, [{ text: 'Stay' }], { holdsShare: true })
    expect(hasOpenPrompts()).toBe(true)
    vi.mocked(Alert.alert).mock.calls[0][2]?.[0].onPress?.()
    expect(hasOpenPrompts()).toBe(false)
  })

  it('releases when Alert.alert throws', () => {
    vi.mocked(Alert.alert).mockImplementation(() => {
      throw new Error('boom')
    })
    expect(() => showAlert('Title')).toThrow('boom')
    settle()
    expect(listening()).toHaveBeenCalledTimes(1)
  })
})

describe('showPrompt', () => {
  it('pauses shake until a button, and passes the typed value on', () => {
    const onSave = vi.fn()
    showPrompt(
      'Edit',
      undefined,
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Save', onPress: onSave }],
      'plain-text',
      '2 eggs',
    )
    expect(paused()).toHaveBeenCalledTimes(1)
    expect(hasOpenPrompts()).toBe(true)
    const [title, , buttons, type, value] = vi.mocked(Alert.prompt).mock
      .calls[0]
    expect([title, type, value]).toEqual(['Edit', 'plain-text', '2 eggs'])

    const shown = buttons as AlertButton[]
    shown[1].onPress?.('3 eggs')
    expect(onSave).toHaveBeenCalledWith('3 eggs')
    expect(hasOpenPrompts()).toBe(false)
    settle()
    expect(listening()).toHaveBeenCalledTimes(1)
  })
})

describe('showPrompt, when nothing shows', () => {
  afterEach(() => {
    Platform.OS = 'ios'
  })

  it('holds nothing on Android, where no button ever comes back', () => {
    Platform.OS = 'android'
    showPrompt('Edit', undefined, [{ text: 'Save' }])
    expect(hasOpenPrompts()).toBe(false)
    expect(paused()).not.toHaveBeenCalled()
  })

  it('releases when Alert.prompt throws', () => {
    vi.mocked(Alert.prompt).mockImplementation(() => {
      throw new Error('boom')
    })
    expect(() => showPrompt('Edit', undefined, [])).toThrow('boom')
    expect(hasOpenPrompts()).toBe(false)
    settle()
    expect(listening()).toHaveBeenCalledTimes(1)
  })
})

describe('showActionSheet', () => {
  it('pauses shake until a choice, then calls back', () => {
    const callback = vi.fn()
    showActionSheet({ options: ['A', 'Cancel'], cancelButtonIndex: 1 }, callback)
    expect(paused()).toHaveBeenCalledTimes(1)

    vi.mocked(ActionSheetIOS.showActionSheetWithOptions).mock.calls[0][1](1)
    expect(callback).toHaveBeenCalledWith(1)
    settle()
    expect(listening()).toHaveBeenCalledTimes(1)
  })
})

describe.each([
  ['launchImageLibraryAsync', launchImageLibraryAsync, nativeLaunchLibrary],
  ['launchCameraAsync', launchCameraAsync, nativeLaunchCamera],
  [
    'openBrowserAsync',
    (options?: object) => openBrowserAsync('https://example.com', options),
    nativeOpenBrowser,
  ],
  [
    'requestMediaLibraryPermissionsAsync',
    () => requestMediaLibraryPermissionsAsync(),
    nativeLibraryPermission,
  ],
  [
    'requestCameraPermissionsAsync',
    () => requestCameraPermissionsAsync(),
    nativeCameraPermission,
  ],
] as const)('%s', (name, launch, native) => {
  it('pauses shake while the picker is open and resumes after it settles', async () => {
    let finish: (result: unknown) => void = () => {}
    vi.mocked(native).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }) as never,
    )
    const pending = launch({ quality: 1 })
    expect(paused()).toHaveBeenCalledTimes(1)
    if (name.startsWith('request')) {
      expect(native).toHaveBeenCalledTimes(1)
    } else if (name === 'openBrowserAsync') {
      expect(native).toHaveBeenCalledWith('https://example.com', { quality: 1 })
    } else {
      expect(native).toHaveBeenCalledWith({ quality: 1 })
    }

    finish({ canceled: true, assets: null })
    await expect(pending).resolves.toEqual({ canceled: true, assets: null })
    expect(listening()).not.toHaveBeenCalled()
    settle()
    expect(listening()).toHaveBeenCalledTimes(1)
  })

  it('releases when the picker throws', async () => {
    vi.mocked(native).mockRejectedValue(new Error('no camera'))
    await expect(launch()).rejects.toThrow('no camera')
    settle()
    expect(listening()).toHaveBeenCalledTimes(1)
  })
})
