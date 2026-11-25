/**
 * `openWebPage` opens a URL in the in-app browser, alerts when no browser can
 * open it, and ignores a second tap while the browser is already opening
 * (APP-846).
 */
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { openWebPage } from './openWebPage'

const mocks = vi.hoisted(() => ({
  openBrowser: vi.fn(),
  alert: vi.fn(),
}))

vi.mock('../observability/native-presentation', () => ({
  openBrowserAsync: mocks.openBrowser,
  showAlert: mocks.alert,
}))

beforeEach(() => {
  mocks.openBrowser.mockReset().mockResolvedValue({ type: 'opened' })
  mocks.alert.mockReset()
})

describe('openWebPage', () => {
  test('opens the url in the in-app browser without alerting', async () => {
    await openWebPage('https://gather.appelent.nl/privacy', 'Failed')

    expect(mocks.openBrowser).toHaveBeenCalledWith(
      'https://gather.appelent.nl/privacy',
    )
    expect(mocks.alert).not.toHaveBeenCalled()
  })

  test('alerts on failure and allows a retry', async () => {
    mocks.openBrowser.mockRejectedValueOnce(new Error('No matching browser'))

    await openWebPage('https://gather.appelent.nl/privacy', 'Could not open.')
    expect(mocks.alert).toHaveBeenCalledWith('Could not open.')

    await openWebPage('https://gather.appelent.nl/privacy', 'Could not open.')
    expect(mocks.openBrowser).toHaveBeenCalledTimes(2)
    expect(mocks.alert).toHaveBeenCalledTimes(1)
  })

  test('ignores a second tap while the browser is opening', async () => {
    let finish = () => {}
    mocks.openBrowser.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve
      }),
    )

    const first = openWebPage('https://gather.appelent.nl/privacy', 'Failed')
    const second = openWebPage('https://gather.appelent.nl/about', 'Failed')
    expect(mocks.openBrowser).toHaveBeenCalledTimes(1)

    finish()
    await Promise.all([first, second])
    expect(mocks.alert).not.toHaveBeenCalled()
  })
})
