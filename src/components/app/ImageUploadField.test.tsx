import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { stubImagePipeline } from '../../test/imagePipeline'
import { ImageUploadField } from './ImageUploadField'

/**
 * The upload field, driven the way a person drives it: choose a file, frame it,
 * confirm — or don't.
 *
 * These run through the real crop editor and the real prepare step, with only
 * the browser's image pipeline and the network stubbed, because the guarantee
 * this feature exists to make is about *when* an upload happens as much as
 * about what is in it. A test that mocked preparing would still pass if
 * choosing a file uploaded the original.
 */

const CHOSEN = new File(['original bytes'], 'IMG_4021.HEIC', {
  type: 'image/jpeg',
})

const uploaded: Array<{ body: unknown; headers: Record<string, string> }> = []

/** Stub a browser that cannot read the chosen file. */
function givenAnUnreadablePhoto() {
  stubImagePipeline({
    decode: async () => {
      throw new Error('unsupported image type')
    },
  })
}

function renderField(preset: 'childPhoto' | 'recipePhoto' = 'childPhoto') {
  const onChange = vi.fn()
  render(
    <ImageUploadField
      imageUrl={null}
      preset={preset}
      onChange={onChange}
      generateUploadUrl={async () => 'https://convex.example/upload'}
    />,
  )
  return { onChange }
}

function choose(file: File = CHOSEN) {
  const input = screen.getByLabelText('Photo')
  fireEvent.change(input, { target: { files: [file] } })
}

beforeEach(() => {
  uploaded.length = 0
  stubImagePipeline({ width: 4032, height: 3024 })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      uploaded.push({
        body: init.body,
        headers: init.headers as Record<string, string>,
      })
      return {
        ok: true,
        json: async () => ({ storageId: 'kg2stored' }),
      } as Response
    }),
  )
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('choosing a photo', () => {
  test('uploads nothing until the person confirms the frame', async () => {
    const { onChange } = renderField()

    choose()

    await screen.findByRole('dialog', { name: 'Frame your photo' })
    expect(uploaded).toHaveLength(0)
    expect(onChange).not.toHaveBeenCalled()
  })

  test('uploads the prepared photo once, as a JPEG, on confirming', async () => {
    const { onChange } = renderField()
    choose()

    fireEvent.click(await screen.findByRole('button', { name: 'Use photo' }))

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('kg2stored'))
    expect(uploaded).toHaveLength(1)
    expect(uploaded[0].headers).toEqual({ 'Content-Type': 'image/jpeg' })
    expect(uploaded[0].body).toBeInstanceOf(Blob)
    // The file the person chose is not what went up.
    expect((uploaded[0].body as Blob).type).toBe('image/jpeg')
    expect(await (uploaded[0].body as Blob).text()).toBe('prepared jpeg')
    expect(
      screen.queryByRole('dialog', { name: 'Frame your photo' }),
    ).not.toBeInTheDocument()
  })

  test('abandoning the frame uploads nothing at all', async () => {
    const { onChange } = renderField()
    choose()

    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))

    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Frame your photo' }),
      ).not.toBeInTheDocument(),
    )
    expect(uploaded).toHaveLength(0)
    expect(onChange).not.toHaveBeenCalled()
  })

  test('the same file can be chosen again after cancelling', async () => {
    renderField()
    choose()
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))

    choose()

    expect(
      await screen.findByRole('dialog', { name: 'Frame your photo' }),
    ).toBeInTheDocument()
  })
})

describe('an image this browser cannot read', () => {
  test('says so, and uploads nothing', async () => {
    givenAnUnreadablePhoto()
    const { onChange } = renderField()

    choose()

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(/could not be opened/i)
    expect(alert.textContent).toMatch(/JPEG/)
    expect(uploaded).toHaveLength(0)
    expect(onChange).not.toHaveBeenCalled()
  })

  test('offers no way to confirm a frame it never drew', async () => {
    givenAnUnreadablePhoto()
    renderField()
    choose()

    await screen.findByRole('alert')
    expect(screen.getByRole('button', { name: 'Use photo' })).toBeDisabled()
  })
})

describe('what the preset decides', () => {
  test("a child's photo is stored as a 512px square", async () => {
    renderField('childPhoto')
    choose()

    expect(await screen.findByText(/Stored as 512 × 512/)).toBeInTheDocument()
  })

  test('a recipe photo keeps the whole frame at 1600px', async () => {
    renderField('recipePhoto')
    choose()

    expect(await screen.findByText(/Stored as 1600 × 1200/)).toBeInTheDocument()
  })
})

describe('when the upload itself fails', () => {
  test('says so and reports no storage id', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false }) as Response),
    )
    const { onChange } = renderField()
    choose()

    fireEvent.click(await screen.findByRole('button', { name: 'Use photo' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not upload that image',
    )
    expect(onChange).not.toHaveBeenCalled()
  })
})
