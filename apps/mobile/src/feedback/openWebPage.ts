import {
  openBrowserAsync,
  showAlert,
} from '../observability/native-presentation'

let opening = false

/**
 * Opens a web page in the in-app browser, and says so when no browser can open
 * it. A second tap while it is opening does nothing: iOS refuses a second
 * browser, which would read as a failure.
 */
export async function openWebPage(url: string, failedMessage: string) {
  if (opening) return
  opening = true
  try {
    await openBrowserAsync(url)
  } catch {
    showAlert(failedMessage)
  } finally {
    opening = false
  }
}
