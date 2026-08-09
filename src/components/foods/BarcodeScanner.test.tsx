import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { renderWithI18n } from '../../lib/i18n/testing'
import { BarcodeScanner } from './BarcodeScanner'

// jsdom does not implement navigator.mediaDevices at all (it's `undefined`,
// not a stub object), so vi.spyOn has nothing to attach to unless we give it
// a stand-in first. This is a jsdom gap, not a component bug.
beforeEach(() => {
  // The stand-in below is defined once and outlives the test that defined it,
  // and `vi.spyOn` hands back the mock that is already there rather than
  // wrapping it again — so without this, "was the camera asked for?" reads the
  // previous test's answer.
  vi.clearAllMocks()
  if (!navigator.mediaDevices) {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn() },
      configurable: true,
    })
  }
  vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue()
})

afterEach(() => {
  vi.restoreAllMocks()
})

/** A stream that reports whether anybody turned it off again. */
function fakeStream() {
  const stop = vi.fn()
  return { stream: { getTracks: () => [{ stop }] }, stop }
}

test('manual entry keeps only digits and calls onDetected on Look up', () => {
  const onDetected = vi.fn()
  renderWithI18n(<BarcodeScanner onDetected={onDetected} />)

  const input = screen.getByLabelText('Or enter the barcode number')
  fireEvent.change(input, { target: { value: '87a10-398b16000 5' } })
  expect(input).toHaveValue('8710398160005')

  fireEvent.click(screen.getByRole('button', { name: /look up/i }))
  expect(onDetected).toHaveBeenCalledWith('8710398160005')
})

test('the Look up button is disabled until at least 8 digits are entered', () => {
  renderWithI18n(<BarcodeScanner onDetected={vi.fn()} />)
  const lookUp = screen.getByRole('button', { name: /look up/i })
  const input = screen.getByLabelText('Or enter the barcode number')

  expect(lookUp).toBeDisabled()
  fireEvent.change(input, { target: { value: '1234567' } })
  expect(lookUp).toBeDisabled()
  fireEvent.change(input, { target: { value: '12345678' } })
  expect(lookUp).not.toBeDisabled()
})

test('shows a fallback message when camera access is denied', async () => {
  vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockRejectedValue(
    new DOMException('Permission denied', 'NotAllowedError'),
  )
  renderWithI18n(<BarcodeScanner onDetected={vi.fn()} />)

  fireEvent.click(screen.getByRole('button', { name: /scan barcode/i }))
  await waitFor(() =>
    expect(
      screen.getByText(/camera access was denied or unavailable/i),
    ).toBeDefined(),
  )
  // The scan button is replaced by the error message, not left dangling.
  expect(screen.queryByRole('button', { name: /scan barcode/i })).toBeNull()
})

test('the camera stays off until it is asked for', async () => {
  // The foods list renders a scanner on a page that is not about scanning.
  // Opening that page must not turn a camera on.
  const getUserMedia = vi
    .spyOn(navigator.mediaDevices, 'getUserMedia')
    .mockResolvedValue(fakeStream().stream as unknown as MediaStream)
  renderWithI18n(<BarcodeScanner onDetected={vi.fn()} />)

  expect(getUserMedia).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: /scan barcode/i }))
  await waitFor(() => expect(getUserMedia).toHaveBeenCalled())
})

test('autoStart opens the camera without anybody pressing Scan again', async () => {
  const getUserMedia = vi
    .spyOn(navigator.mediaDevices, 'getUserMedia')
    .mockResolvedValue(fakeStream().stream as unknown as MediaStream)
  renderWithI18n(<BarcodeScanner onDetected={vi.fn()} autoStart />)

  await waitFor(() => expect(getUserMedia).toHaveBeenCalled())
  // And the scanner's own Scan/Stop button is gone: the surface that set
  // autoStart is the one that started this and the one that stops it.
  expect(screen.queryByRole('button', { name: /scan barcode/i })).toBeNull()
  expect(screen.queryByRole('button', { name: /^stop$/i })).toBeNull()
})

test('an auto-started camera is turned off again when the scanner goes away', async () => {
  const { stream, stop } = fakeStream()
  vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(
    stream as unknown as MediaStream,
  )
  const view = renderWithI18n(<BarcodeScanner onDetected={vi.fn()} autoStart />)

  await waitFor(() => expect(screen.getByRole('button', { name: /look up/i })))
  view.unmount()
  await waitFor(() => expect(stop).toHaveBeenCalled())
})

test('autoStart with the camera denied falls back rather than showing a dead camera', async () => {
  vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockRejectedValue(
    new DOMException('Permission denied', 'NotAllowedError'),
  )
  renderWithI18n(<BarcodeScanner onDetected={vi.fn()} autoStart />)

  await waitFor(() =>
    expect(
      screen.getByText(/camera access was denied or unavailable/i),
    ).toBeDefined(),
  )
  // The manual barcode field is still the way through.
  expect(screen.getByLabelText('Or enter the barcode number')).toBeDefined()
})
