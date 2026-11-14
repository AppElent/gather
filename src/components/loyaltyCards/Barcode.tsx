import type { BarcodeFormat } from '@gather/core/barcodes'
import { barcodeShape } from '@gather/core/barcodes'
import { useEffect, useState } from 'react'
import { useMessages } from '../../lib/i18n'
import { renderBarcodeSvg, svgDataUrl } from './barcodeImage'

type Drawn = { src: string } | { failed: true } | null

interface BarcodeProps {
  format: BarcodeFormat
  value: string
  /** The accessible name: which store, which format. */
  label: string
  size?: 'large' | 'small'
}

/**
 * A scannable barcode on a white panel, in light and dark mode alike: a till
 * scanner reads dark bars on a light ground, so the theme stops at the panel.
 *
 * Drawing failures are not reported to Sentry: the number is shown below the
 * code either way, and the error would carry nothing a person could act on.
 */
export function Barcode({ format, value, label, size = 'large' }: BarcodeProps) {
  const copy = useMessages().loyaltyCards.detail
  const [drawn, setDrawn] = useState<Drawn>(null)

  useEffect(() => {
    let cancelled = false
    setDrawn(null)
    renderBarcodeSvg(format, value).then(
      (svg) => {
        if (!cancelled) setDrawn({ src: svgDataUrl(svg) })
      },
      () => {
        if (!cancelled) setDrawn({ failed: true })
      },
    )
    return () => {
      cancelled = true
    }
  }, [format, value])

  const matrix = barcodeShape(format) === 'matrix'
  const box =
    size === 'large'
      ? matrix
        ? 'mx-auto w-full max-w-72'
        : 'mx-auto w-full max-w-xl'
      : matrix
        ? 'mx-auto w-full max-w-40'
        : 'mx-auto w-full max-w-sm'

  return (
    <div className="rounded-[var(--app-radius)] bg-white p-4 text-black">
      {drawn === null ? (
        <p className="m-0 py-8 text-center text-sm text-neutral-600">
          {copy.drawing}
        </p>
      ) : 'failed' in drawn ? (
        <p role="alert" className="m-0 py-4 text-center text-sm text-red-800">
          {copy.drawFailed}
        </p>
      ) : (
        <img
          src={drawn.src}
          alt={label}
          className={`${box} block h-auto`}
          style={{ imageRendering: 'pixelated' }}
        />
      )}
    </div>
  )
}
