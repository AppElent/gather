import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import type { RetailerSuggestion } from '../../../convex/loyaltyCards'
import { renderWithI18n } from '../../lib/i18n/testing'
import { LoyaltyCardForm, type LoyaltyCardFormValues } from './LoyaltyCardForm'

/**
 * The card form checks the number the way Convex will, as it is typed, so a
 * wrong digit shows here and not at a till.
 */

const AH: RetailerSuggestion = {
  seedKey: 'albert-heijn',
  name: 'Albert Heijn',
  aliases: ['AH', 'Bonuskaart'],
  category: 'supermarket',
  brandColor: '#00a0e2',
  domain: 'ah.nl',
  barcodeFormat: 'EAN_13',
  formatConfidence: 'sourced',
  numberLength: 13,
}

const EMPTY: LoyaltyCardFormValues = {
  storeName: 'Albert Heijn',
  cardNumber: '',
  barcodeFormat: 'EAN_13',
  holder: '',
  note: '',
}

function renderForm(
  props: Partial<Parameters<typeof LoyaltyCardForm>[0]> = {},
) {
  const onSubmit = vi.fn()
  renderWithI18n(
    <LoyaltyCardForm
      initial={EMPTY}
      retailer={AH}
      customStore={false}
      generateUploadUrl={async () => 'https://upload.test'}
      submitting={false}
      onSubmit={onSubmit}
      {...props}
    />,
  )
  return onSubmit
}

describe('the card number', () => {
  test('a wrong check digit is named and nothing is saved', () => {
    const onSubmit = renderForm()
    const number = screen.getByLabelText('Card number')
    fireEvent.change(number, { target: { value: '2620187342053' } })
    fireEvent.blur(number)

    expect(
      screen.getByText(
        'The last digit does not match. Check the number on the card.',
      ),
    ).toBeVisible()
    expect(number).toHaveAttribute('aria-invalid', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Save card' }))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  test('is not complained about before the person has left the field', () => {
    renderForm()
    fireEvent.change(screen.getByLabelText('Card number'), {
      target: { value: '26' },
    })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(
      screen.queryByText(
        'That number is the wrong length for this barcode type.',
      ),
    ).toBeNull()
  })

  test('a valid number is saved without the spaces copied off the card', () => {
    const onSubmit = renderForm()
    fireEvent.change(screen.getByLabelText('Card number'), {
      target: { value: '2620 1873 4205 2' },
    })
    fireEvent.change(screen.getByLabelText('Whose card'), {
      target: { value: '  Nora ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save card' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        storeName: 'Albert Heijn',
        brandColor: undefined,
        cardNumber: '2620187342052',
        barcodeFormat: 'EAN_13',
        holder: 'Nora',
      }),
    )
  })

  test('shows the Catalog length as a hint', () => {
    renderForm()
    expect(screen.getByLabelText('Card number')).toHaveAccessibleDescription(
      '13 characters.',
    )
  })
})

describe('the barcode type', () => {
  test('says so when the Catalog only guessed it', () => {
    renderForm({
      retailer: { ...AH, barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
      initial: { ...EMPTY, barcodeFormat: 'CODE_128' },
    })
    expect(screen.getByLabelText('Barcode type')).toHaveAccessibleDescription(
      'We are not sure which barcode Albert Heijn uses. If the till cannot scan it, try another type.',
    )
  })

  test('changing it re-checks the number', () => {
    const onSubmit = renderForm()
    fireEvent.change(screen.getByLabelText('Card number'), {
      target: { value: 'dg-4217' },
    })
    fireEvent.change(screen.getByLabelText('Barcode type'), {
      target: { value: 'CODE_39' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save card' }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ cardNumber: 'DG-4217', barcodeFormat: 'CODE_39' }),
    )
  })
})

test('a store typed by hand chooses its own colour', () => {
  const onSubmit = renderForm({
    retailer: undefined,
    customStore: true,
    initial: { ...EMPTY, storeName: '', barcodeFormat: 'CODE_128' },
  })
  fireEvent.change(screen.getByLabelText('Store'), {
    target: { value: 'Bakkerij De Graaf' },
  })
  fireEvent.change(screen.getByLabelText('Colour'), {
    target: { value: '#aa3300' },
  })
  fireEvent.change(screen.getByLabelText('Card number'), {
    target: { value: 'DG-004217' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save card' }))
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      storeName: 'Bakkerij De Graaf',
      brandColor: '#aa3300',
    }),
  )
})
