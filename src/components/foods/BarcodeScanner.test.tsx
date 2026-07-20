import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { BarcodeScanner } from './BarcodeScanner'

// jsdom does not implement navigator.mediaDevices at all (it's `undefined`,
// not a stub object), so vi.spyOn has nothing to attach to unless we give it
// a stand-in first. This is a jsdom gap, not a component bug.
beforeEach(() => {
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

test('manual entry keeps only digits and calls onDetected on Look up', () => {
  const onDetected = vi.fn()
  render(<BarcodeScanner onDetected={onDetected} />)

  const input = screen.getByLabelText('Or enter the barcode number')
  fireEvent.change(input, { target: { value: '87a10-398b16000 5' } })
  expect(input).toHaveValue('8710398160005')

  fireEvent.click(screen.getByRole('button', { name: /look up/i }))
  expect(onDetected).toHaveBeenCalledWith('8710398160005')
})

test('the Look up button is disabled until at least 8 digits are entered', () => {
  render(<BarcodeScanner onDetected={vi.fn()} />)
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
  render(<BarcodeScanner onDetected={vi.fn()} />)

  fireEvent.click(screen.getByRole('button', { name: /scan barcode/i }))
  await waitFor(() =>
    expect(
      screen.getByText(/camera access was denied or unavailable/i),
    ).toBeDefined(),
  )
  // The scan button is replaced by the error message, not left dangling.
  expect(screen.queryByRole('button', { name: /scan barcode/i })).toBeNull()
})
