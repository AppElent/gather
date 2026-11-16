import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { RetailerSuggestion } from '../../../convex/loyaltyCards'
import { renderWithI18n } from '../../lib/i18n/testing'
import { stubImagePipeline } from '../photo/testing'
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

test('saving without a store name says so and goes to the field', () => {
  const onSubmit = renderForm({
    retailer: undefined,
    customStore: true,
    initial: { ...EMPTY, storeName: '', barcodeFormat: 'CODE_128' },
  })
  fireEvent.change(screen.getByLabelText('Card number'), {
    target: { value: 'DG-004217' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save card' }))

  const store = screen.getByLabelText('Store')
  expect(onSubmit).not.toHaveBeenCalled()
  expect(store).toHaveAttribute('aria-invalid', 'true')
  expect(store).toHaveAccessibleDescription('Enter the store’s name.')
  expect(store).toHaveFocus()
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

describe('a photo still uploading', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  test('holds the save until it has landed, then saves it with the card', async () => {
    stubImagePipeline({ width: 1200, height: 756 })
    let land: () => void = () => {}
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            land = () =>
              resolve({
                ok: true,
                json: async () => ({ storageId: 'kg2front' }),
              } as Response)
          }),
      ),
    )
    const onSubmit = renderForm()
    fireEvent.change(screen.getByLabelText('Card number'), {
      target: { value: '2620187342052' },
    })
    fireEvent.change(screen.getByLabelText('Front of the card'), {
      target: { files: [new File(['card'], 'front.jpg', { type: 'image/jpeg' })] },
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Use photo' }))

    const waiting = await screen.findByRole('button', {
      name: 'Waiting for the photo…',
    })
    expect(waiting).toBeDisabled()
    // Submitting the form another way (Enter in a field) is held too.
    fireEvent.submit(waiting.closest('form') as HTMLFormElement)
    expect(onSubmit).not.toHaveBeenCalled()

    land()
    const save = await screen.findByRole('button', { name: 'Save card' })
    await waitFor(() => expect(save).toBeEnabled())
    fireEvent.click(save)
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ frontPhotoId: 'kg2front' }),
    )
  })
})

describe('after a store is picked', () => {
  test('the cursor goes to the card number when the store came from the list', () => {
    renderForm({ focusOnOpen: 'cardNumber' })
    expect(screen.getByLabelText('Card number')).toHaveFocus()
  })

  test('the cursor goes to the store name for another store', () => {
    renderForm({
      retailer: undefined,
      customStore: true,
      initial: { ...EMPTY, storeName: '' },
      focusOnOpen: 'storeName',
    })
    expect(screen.getByLabelText('Store')).toHaveFocus()
  })

  test('editing a card leaves the cursor where it was', () => {
    renderForm()
    expect(screen.getByLabelText('Card number')).not.toHaveFocus()
    expect(screen.getByLabelText('Store')).not.toHaveFocus()
  })
})

test('a digits-only barcode type offers a number pad, and others do not', () => {
  renderForm()
  const number = screen.getByLabelText('Card number')
  expect(number).toHaveAttribute('inputmode', 'numeric')
  fireEvent.change(screen.getByLabelText('Barcode type'), {
    target: { value: 'CODE_128' },
  })
  expect(number).toHaveAttribute('inputmode', 'text')
})

describe('a custom store colour', () => {
  test('offers the phone’s preset colours and saves the one picked', () => {
    const onSubmit = renderForm({
      retailer: undefined,
      customStore: true,
      initial: { ...EMPTY, storeName: 'Bakker Jan', barcodeFormat: 'CODE_128' },
    })
    const color = screen.getByLabelText('Colour')
    const presets = document.getElementById(
      color.getAttribute('list') ?? '',
    )?.querySelectorAll('option')
    expect([...(presets ?? [])].map((option) => option.value)).toEqual([
      '#475569',
      '#dc2626',
      '#ea580c',
      '#facc15',
      '#16a34a',
      '#0d9488',
      '#2563eb',
      '#7c3aed',
      '#db2777',
      '#78350f',
    ])

    fireEvent.change(color, { target: { value: '#16a34a' } })
    fireEvent.change(screen.getByLabelText('Card number'), {
      target: { value: 'JAN-42' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save card' }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ brandColor: '#16a34a' }),
    )
  })
})
