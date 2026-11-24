// biome-ignore-all lint/correctness/useReactNativePlatformComponents: the action sheet wrapper is iOS-only, like ActionSheetIOS itself.
/**
 * The only place the app presents an OS alert, prompt, action sheet, image
 * picker or its permission prompt, or an in-app browser.
 *
 * Each is presented from the root view controller, the same one Sentry's
 * feedback form needs, so a shake while one is open strands the form's
 * backdrop. These wrappers hold shake-to-report for as long as the
 * presentation is up and release on every way out. `biome.json` bans
 * importing `Alert`, `ActionSheetIOS`, `expo-image-picker` and `expo-web-browser` anywhere
 * else.
 * Copied from Foundry (APP-258); `showPrompt` is Gather's addition.
 */
import * as ImagePicker from 'expo-image-picker'
import * as WebBrowser from 'expo-web-browser'
import {
  ActionSheetIOS,
  type ActionSheetIOSOptions,
  Alert,
  type AlertButton,
  type AlertOptions,
  type AlertType,
} from 'react-native'

import { openPrompt } from '../components/openSheets'
import { holdShakeToReport } from './shake-to-report'

export type {
  ImagePickerAsset,
  ImagePickerOptions,
  ImagePickerResult,
} from 'expo-image-picker'

/** Holds shake-to-report, and the Drop chooser when a share must wait. */
function holdAlert(holdsShare = false) {
  const release = holdShakeToReport()
  const answered = holdsShare ? openPrompt() : undefined
  return () => {
    release()
    answered?.()
  }
}

/** Each button releases the hold before doing what it did. */
function releasing(buttons: AlertButton[], release: () => void) {
  return buttons.map((button) => ({
    ...button,
    onPress: (value?: string) => {
      release()
      button.onPress?.(value)
    },
  }))
}

/**
 * `Alert.alert`, holding shake-to-report until a button or the dismissal.
 * `holdsShare` also keeps the Drop chooser back until then, for a question
 * whose answer opens a sheet (APP-672).
 */
export function showAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
  { holdsShare, ...options }: AlertOptions & { holdsShare?: boolean } = {},
) {
  const release = holdAlert(holdsShare)
  // With no buttons iOS adds an OK nobody can observe, so name it here.
  const shown = buttons?.length ? buttons : [{ text: 'OK' }]
  try {
    Alert.alert(title, message, releasing(shown, release), {
      ...options,
      onDismiss: () => {
        release()
        options.onDismiss?.()
      },
    })
  } catch (error) {
    release()
    throw error
  }
}

/**
 * `Alert.prompt` (iOS only), held until one of its buttons. A share waits for
 * it: closing the form under it would drop what is being typed (APP-672).
 */
export function showPrompt(
  title: string,
  message: string | undefined,
  buttons: AlertButton[],
  type?: AlertType,
  defaultValue?: string,
) {
  const release = holdAlert(true)
  try {
    Alert.prompt(title, message, releasing(buttons, release), type, defaultValue)
  } catch (error) {
    release()
    throw error
  }
}

/** `ActionSheetIOS.showActionSheetWithOptions`, held until a choice or a tap away. */
export function showActionSheet(
  options: ActionSheetIOSOptions,
  callback: (buttonIndex: number) => void,
) {
  const release = holdShakeToReport()
  try {
    ActionSheetIOS.showActionSheetWithOptions(options, (index) => {
      release()
      callback(index)
    })
  } catch (error) {
    release()
    throw error
  }
}

async function whilePickerOpen<T>(open: () => Promise<T>): Promise<T> {
  const release = holdShakeToReport()
  try {
    return await open()
  } finally {
    release()
  }
}

export function launchImageLibraryAsync(
  options?: ImagePicker.ImagePickerOptions,
) {
  return whilePickerOpen(() => ImagePicker.launchImageLibraryAsync(options))
}

export function launchCameraAsync(options?: ImagePicker.ImagePickerOptions) {
  return whilePickerOpen(() => ImagePicker.launchCameraAsync(options))
}

/**
 * The OS permission prompts before a picker: a system alert over the app, so
 * held like one (a shake there opened the form under it on the simulator).
 */
export function requestMediaLibraryPermissionsAsync(writeOnly?: boolean) {
  return whilePickerOpen(() =>
    ImagePicker.requestMediaLibraryPermissionsAsync(writeOnly),
  )
}

export function requestCameraPermissionsAsync() {
  return whilePickerOpen(() => ImagePicker.requestCameraPermissionsAsync())
}

/** The in-app browser (SFSafariViewController), held until it closes. */
export function openBrowserAsync(
  url: string,
  options?: WebBrowser.WebBrowserOpenOptions,
) {
  return whilePickerOpen(() => WebBrowser.openBrowserAsync(url, options))
}
