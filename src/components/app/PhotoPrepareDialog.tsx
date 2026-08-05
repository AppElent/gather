import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  type CropRect,
  cropFraction,
  initialCrop,
  moveCrop,
  resizeCrop,
  type Size,
  scaleCrop,
} from '../../lib/cropFrame'
import { errorMessage } from '../../lib/errorMessage'
import { fmt, useMessages } from '../../lib/i18n'
import type { Messages } from '../../lib/i18n/messages/en'
import { type PhotoPresetName, photoPreset } from '../../lib/photoPresets'
import {
  type DecodedPhoto,
  decodePhoto,
  outputSize,
  PHOTO_DECODE_ERROR,
  PHOTO_PREPARE_ERROR,
  type PreparedPhoto,
  preparePhoto,
} from '../../lib/preparePhoto'
import { SurfaceCard } from './ShellPrimitives'

/**
 * The framing step: the whole of what "prepare" looks like to a person
 * (ADR-0010).
 *
 * It is shown on every upload rather than behind an "adjust" affordance,
 * because mis-framing is permanent here — there is no original to re-crop from,
 * only the stored square — and a step nobody finds is a step that never
 * corrects anything. Nothing is uploaded while this is open, and closing it
 * uploads nothing at all: the caller is handed prepared bytes exactly once, on
 * confirm.
 *
 * Two pixel spaces meet here and must not be confused. The frame lives in the
 * decoded image's own pixels; the preview is however many CSS pixels the box
 * happens to be. Drags convert from the second to the first on the way in, and
 * the overlay is positioned as a percentage on the way out, so nothing between
 * them depends on the size of the screen.
 *
 * The preview is the chosen file drawn by the browser, while the bytes come
 * from a bitmap decoded with `imageOrientation: 'from-image'`. Those agree:
 * both apply the EXIF orientation, which is what makes framing a portrait photo
 * mean the same thing on screen as it does on the canvas.
 */

interface PhotoPrepareDialogProps {
  file: File
  preset: PhotoPresetName
  onCancel: () => void
  onConfirm: (prepared: PreparedPhoto) => void
}

/**
 * The words for a failure `preparePhoto` reports as a code, and the error's own
 * message for anything else. The codes exist because that module is a plain one
 * with no locale to write a sentence in (ADR-0011).
 *
 * Resolved at render rather than where the failure is caught: decoding must
 * re-run for a new file and for nothing else, and reading a message inside that
 * effect would put the locale in its dependencies — re-decoding the photo and
 * discarding the frame the person had set, because they switched language.
 */
function photoErrorText(
  detail: string,
  image: Messages['common']['image'],
): string {
  if (detail === PHOTO_DECODE_ERROR) return image.decodeFailed
  if (detail === PHOTO_PREPARE_ERROR) return image.prepareFailed
  return detail
}

export function PhotoPrepareDialog({
  file,
  preset,
  onCancel,
  onConfirm,
}: PhotoPrepareDialogProps) {
  const messages = useMessages()
  const image = messages.common.image
  const cancelLabel = messages.common.actions.cancel
  const rules = photoPreset(preset)
  const { aspect, maxEdge } = rules
  const [photo, setPhoto] = useState<DecodedPhoto | null>(null)
  const [crop, setCrop] = useState<CropRect | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const frameRef = useRef<HTMLButtonElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const framePlacedRef = useRef(false)
  const abandonedRef = useRef(false)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  // Decoding is where "this browser cannot read this image" is found out, so it
  // happens before any framing is offered rather than after it is done.
  useEffect(() => {
    let decodedPhoto: DecodedPhoto | null = null
    let abandoned = false
    setError(null)
    decodePhoto(file)
      .then((next) => {
        decodedPhoto = next
        if (abandoned) {
          next.close()
          return
        }
        setPhoto(next)
        setCrop(initialCrop(next, aspect))
      })
      .catch((e: unknown) => {
        if (!abandoned) setError(errorMessage(e, PHOTO_DECODE_ERROR))
      })
    return () => {
      abandoned = true
      decodedPhoto?.close()
      setPhoto(null)
      setCrop(null)
    }
  }, [file, aspect])

  // Leaving is final, and it is recorded the moment the person goes rather
  // than whenever the unmount lands, so nothing in flight can outlive it.
  useEffect(() => {
    abandonedRef.current = false
    return () => {
      abandonedRef.current = true
    }
  }, [])

  const abandon = useCallback(() => {
    abandonedRef.current = true
    onCancel()
  }, [onCancel])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') abandon()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [abandon])

  // Focus goes to the frame and comes back to the file input afterwards, the
  // same way `ConfirmAction` treats the question it opens. It matters more
  // here: the frame is the control, and someone working by keyboard would
  // otherwise have to tab into a dialog to reach the only thing in it that
  // does anything.
  useEffect(() => {
    openerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    return () => {
      const opener = openerRef.current
      if (opener?.isConnected) opener.focus()
    }
  }, [])

  // Once, when the frame first appears — not on every adjustment, which would
  // snatch focus back off the size slider as someone was using it.
  useEffect(() => {
    if (!crop || framePlacedRef.current) return
    framePlacedRef.current = true
    frameRef.current?.focus()
  }, [crop])

  /** Tab stays inside the framing step until it is answered one way or another. */
  const keepFocusInside = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return
    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])',
      ),
    )
    const first = focusable[0]
    const last = focusable.at(-1)
    if (!first || !last) return
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  /**
   * A drag in progress, frozen at the moment it started.
   *
   * Deltas are measured from the frame the drag began with rather than
   * accumulated onto the current one, so a drag that is clamped at an edge and
   * then dragged back returns to where it was instead of drifting.
   */
  const dragRef = useRef<{
    startX: number
    startY: number
    from: CropRect
    mode: 'move' | 'resize'
    /** Source pixels per CSS pixel of the preview. */
    scale: number
  } | null>(null)

  const beginDrag =
    (mode: 'move' | 'resize') => (event: ReactPointerEvent<HTMLElement>) => {
      if (!photo || !crop) return
      const box = imageRef.current?.getBoundingClientRect()
      if (!box || box.width === 0) return
      event.preventDefault()
      event.stopPropagation()
      dragRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        from: crop,
        mode,
        scale: photo.width / box.width,
      }
      event.currentTarget.setPointerCapture?.(event.pointerId)
    }

  /**
   * What a grab of each handle means, in one place.
   *
   * A pointer drag and an arrow key are the same two gestures arriving by
   * different routes, so they resolve to the same pair of functions here
   * rather than each branching on the mode for itself.
   */
  const dragged = (
    mode: 'move' | 'resize',
    from: CropRect,
    image: Size,
    dx: number,
    dy: number,
  ): CropRect =>
    mode === 'move'
      ? moveCrop(from, image, dx, dy)
      : resizeCrop(from, image, aspect, dx, dy)

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    if (!drag || !photo) return
    setCrop(
      dragged(
        drag.mode,
        drag.from,
        photo,
        (event.clientX - drag.startX) * drag.scale,
        (event.clientY - drag.startY) * drag.scale,
      ),
    )
  }

  const endDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (!dragRef.current) return
    dragRef.current = null
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }

  /** Arrow keys, for the people a pointer drag leaves with no way to frame. */
  const nudge =
    (mode: 'move' | 'resize') => (event: React.KeyboardEvent<HTMLElement>) => {
      if (!photo || !crop) return
      const step = Math.max(1, Math.round(photo.width / 50))
      const deltas: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      }
      const delta = deltas[event.key]
      if (!delta) return
      event.preventDefault()
      event.stopPropagation()
      setCrop(dragged(mode, crop, photo, delta[0], delta[1]))
    }

  const confirm = async () => {
    if (!photo || !crop || preparing) return
    setPreparing(true)
    setError(null)
    try {
      const prepared = await preparePhoto(photo, crop, rules)
      // Preparing is not instant, and the person can leave while it runs.
      // Bytes that arrive after they did are not theirs to upload: "abandoning
      // the prepare step uploads nothing at all" has to hold in this gap too,
      // which is the only place the guarantee is racy.
      if (abandonedRef.current) return
      onConfirm(prepared)
    } catch (e: unknown) {
      if (abandonedRef.current) return
      setError(errorMessage(e, PHOTO_PREPARE_ERROR))
      setPreparing(false)
    }
  }

  const storedSize = crop ? outputSize(crop, maxEdge) : null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={image.frameTitle}
        onKeyDown={keepFocusInside}
        className="w-[min(36rem,100%)]"
      >
        <SurfaceCard>
          <div className="grid gap-3">
            <div>
              <h2 className="m-0 text-base font-semibold">
                {image.frameTitle}
              </h2>
              <p className="m-0 text-sm text-[var(--app-muted)]">
                {aspect === null ? image.frameFree : image.frameSquare}
              </p>
            </div>

            {error ? (
              <p
                role="alert"
                className="m-0 rounded-[var(--app-radius)] border border-[color-mix(in_oklch,var(--app-danger)_45%,var(--app-border))] px-3 py-2 text-sm text-[var(--app-danger)]"
              >
                {photoErrorText(error, image)}
              </p>
            ) : null}

            {!error && previewUrl ? (
              <div className="grid justify-items-center overflow-hidden">
                <div className="relative inline-block leading-none">
                  {/* Decorative: the person chose this image a moment ago, and
                      the frame over it is what carries the label. */}
                  <img
                    ref={imageRef}
                    src={previewUrl}
                    alt=""
                    className="block max-h-[50vh] max-w-full select-none"
                    draggable={false}
                  />
                  {/*
                    The frame and its handle are siblings rather than nested,
                    because both are things a person grabs — with a pointer or
                    with the arrow keys once focused — and a control inside a
                    control is neither valid HTML nor reachable by keyboard.
                  */}
                  {crop && photo ? (
                    <>
                      <button
                        ref={frameRef}
                        type="button"
                        aria-label={image.moveFrame}
                        onPointerDown={beginDrag('move')}
                        onPointerMove={onPointerMove}
                        onPointerUp={endDrag}
                        onPointerCancel={endDrag}
                        onKeyDown={nudge('move')}
                        className="absolute cursor-move touch-none border-2 border-white bg-transparent p-0 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] outline-offset-2"
                        style={{
                          left: `${(crop.x / photo.width) * 100}%`,
                          top: `${(crop.y / photo.height) * 100}%`,
                          width: `${(crop.width / photo.width) * 100}%`,
                          height: `${(crop.height / photo.height) * 100}%`,
                        }}
                      />
                      <button
                        type="button"
                        aria-label={image.resizeFrame}
                        onPointerDown={beginDrag('resize')}
                        onPointerMove={onPointerMove}
                        onPointerUp={endDrag}
                        onPointerCancel={endDrag}
                        onKeyDown={nudge('resize')}
                        className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize touch-none rounded-full border-2 border-white bg-[var(--app-accent,#0f766e)]"
                        style={{
                          left: `${((crop.x + crop.width) / photo.width) * 100}%`,
                          top: `${((crop.y + crop.height) / photo.height) * 100}%`,
                        }}
                      />
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}

            {crop && photo ? (
              <label className="grid gap-1 text-sm">
                <span className="font-medium">{image.frameSize}</span>
                <input
                  type="range"
                  min={5}
                  max={100}
                  value={Math.round(cropFraction(crop, photo, aspect) * 100)}
                  onChange={(event) =>
                    setCrop(
                      scaleCrop(
                        crop,
                        photo,
                        aspect,
                        Number(event.target.value) / 100,
                      ),
                    )
                  }
                />
              </label>
            ) : null}

            <p className="m-0 text-xs text-[var(--app-muted)]">
              {storedSize
                ? fmt(image.storedAs, {
                    width: storedSize.width,
                    height: storedSize.height,
                  })
                : image.opening}
            </p>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={abandon}
                className="inline-flex min-h-9 items-center rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 text-sm font-semibold"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                disabled={!crop || preparing}
                onClick={() => void confirm()}
                className="inline-flex min-h-9 items-center rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 text-sm font-semibold disabled:opacity-60"
              >
                {preparing ? image.preparing : image.use}
              </button>
            </div>
          </div>
        </SurfaceCard>
      </div>
    </div>
  )
}
