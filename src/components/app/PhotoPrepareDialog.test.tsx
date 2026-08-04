import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { PhotoPrepareDialog } from './PhotoPrepareDialog'

/**
 * The framing step, checked at the only place its result is observable from a
 * test: the region it hands to `drawImage`.
 *
 * Dragging is not exercised here — jsdom gives every element a zero-sized box,
 * so a pointer drag has no pixels to convert — and it does not need to be. The
 * geometry a drag runs through is `cropFrame`, tested there against the cases
 * that matter; what is left for this file is that the dialog opens on the right
 * frame, keeps a locked frame locked through the controls a person actually
 * has, and hands over only what was framed.
 */

const drawImage = vi.fn()

/** The crop region passed to `drawImage`, in source pixels. */
function drawnRegion() {
  const [, x, y, width, height] = drawImage.mock.calls[0] as number[]
  return { x, y, width, height }
}

function stubImagePipeline(width: number, height: number) {
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({ width, height, close: vi.fn() })),
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage,
  } as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
    (callback, type) => callback(new Blob(['jpeg'], { type: type ?? '' })),
  )
}

function renderDialog(preset: 'childPhoto' | 'recipePhoto') {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(
    <PhotoPrepareDialog
      file={new File(['bytes'], 'photo.jpg', { type: 'image/jpeg' })}
      preset={preset}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  )
  return { onConfirm, onCancel }
}

async function confirm() {
  const button = await screen.findByRole('button', { name: 'Use photo' })
  await waitFor(() => expect(button).toBeEnabled())
  fireEvent.click(button)
}

beforeEach(() => {
  drawImage.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('the frame a photo opens with', () => {
  test('a recipe photo opens on the whole image, so confirming crops nothing', async () => {
    stubImagePipeline(4032, 3024)
    const { onConfirm } = renderDialog('recipePhoto')

    await confirm()

    await waitFor(() => expect(onConfirm).toHaveBeenCalled())
    expect(drawnRegion()).toEqual({ x: 0, y: 0, width: 4032, height: 3024 })
  })

  test("a child's photo opens on the largest square, centred", async () => {
    stubImagePipeline(4032, 3024)
    const { onConfirm } = renderDialog('childPhoto')

    await confirm()

    await waitFor(() => expect(onConfirm).toHaveBeenCalled())
    expect(drawnRegion()).toEqual({ x: 504, y: 0, width: 3024, height: 3024 })
  })

  test('a portrait photo is framed against its upright dimensions', async () => {
    // What `createImageBitmap` returns here is already rotated, because it is
    // asked for `imageOrientation: 'from-image'`. The frame follows the
    // upright shape rather than the shape the pixels are stored in.
    stubImagePipeline(3024, 4032)
    renderDialog('childPhoto')

    expect(await screen.findByText(/Stored as 512 × 512/)).toBeInTheDocument()
    await confirm()
    await waitFor(() => expect(drawImage).toHaveBeenCalled())
    expect(drawnRegion()).toEqual({ x: 0, y: 504, width: 3024, height: 3024 })
  })
})

describe("a child's frame cannot be made non-square", () => {
  test('not with the size slider', async () => {
    stubImagePipeline(4032, 3024)
    const { onConfirm } = renderDialog('childPhoto')

    const slider = await screen.findByLabelText('Frame size')
    fireEvent.change(slider, { target: { value: '37' } })
    await confirm()

    await waitFor(() => expect(onConfirm).toHaveBeenCalled())
    const region = drawnRegion()
    expect(region.width).toBe(region.height)
    expect(region.width).toBeLessThan(3024)
  })

  test('not with the resize handle', async () => {
    stubImagePipeline(4032, 3024)
    const { onConfirm } = renderDialog('childPhoto')

    const handle = await screen.findByRole('button', { name: 'Resize frame' })
    fireEvent.keyDown(handle, { key: 'ArrowLeft' })
    fireEvent.keyDown(handle, { key: 'ArrowUp' })
    await confirm()

    await waitFor(() => expect(onConfirm).toHaveBeenCalled())
    const region = drawnRegion()
    expect(region.width).toBe(region.height)
  })

  test('and the photo it hands back is square', async () => {
    stubImagePipeline(4032, 3024)
    const { onConfirm } = renderDialog('childPhoto')

    const slider = await screen.findByLabelText('Frame size')
    fireEvent.change(slider, { target: { value: '63' } })
    await confirm()

    await waitFor(() => expect(onConfirm).toHaveBeenCalled())
    const prepared = onConfirm.mock.calls[0][0]
    expect(prepared.width).toBe(prepared.height)
    expect(prepared.width).toBeLessThanOrEqual(512)
  })
})

describe('moving the frame', () => {
  test('arrow keys move it, for anyone who cannot drag', async () => {
    stubImagePipeline(4032, 3024)
    const { onConfirm } = renderDialog('childPhoto')

    const frame = await screen.findByRole('button', { name: 'Move frame' })
    fireEvent.keyDown(frame, { key: 'ArrowLeft' })
    await confirm()

    await waitFor(() => expect(onConfirm).toHaveBeenCalled())
    expect(drawnRegion()).toMatchObject({ x: 423, width: 3024 })
  })

  test('never past the edge of the image', async () => {
    stubImagePipeline(4032, 3024)
    const { onConfirm } = renderDialog('childPhoto')

    const frame = await screen.findByRole('button', { name: 'Move frame' })
    for (let i = 0; i < 40; i++) {
      fireEvent.keyDown(frame, { key: 'ArrowRight' })
    }
    await confirm()

    await waitFor(() => expect(onConfirm).toHaveBeenCalled())
    const region = drawnRegion()
    expect(region.x + region.width).toBe(4032)
  })
})

describe('leaving without a photo', () => {
  test('Escape cancels', async () => {
    stubImagePipeline(4032, 3024)
    const { onCancel, onConfirm } = renderDialog('childPhoto')
    await screen.findByRole('button', { name: 'Move frame' })

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onCancel).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
    expect(drawImage).not.toHaveBeenCalled()
  })

  test('a failed prepare keeps the dialog open and hands back nothing', async () => {
    stubImagePipeline(4032, 3024)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
      // The silent PNG substitution `canvas.toBlob` is specified to make.
      (callback) => callback(new Blob(['png'], { type: 'image/png' })),
    )
    const { onConfirm } = renderDialog('recipePhoto')

    await confirm()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /could not be prepared/i,
    )
    expect(onConfirm).not.toHaveBeenCalled()
    expect(
      screen.getByRole('dialog', { name: 'Frame your photo' }),
    ).toBeInTheDocument()
  })
})
