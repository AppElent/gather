import {
  DEFAULT_STORE_COLOR,
  storeMonogram,
  textOnBrand,
} from '@gather/core/loyalty-cards'
import { useState } from 'react'
import { fmt, useMessages } from '../../lib/i18n'
import { retailerLogoImage } from './retailerLogoImage'

const SIZES = {
  small: { box: 'h-10 w-10 text-sm', px: '40px' },
  medium: { box: 'h-14 w-14 text-lg', px: '56px' },
  large: { box: 'h-16 w-16 text-xl', px: '64px' },
} as const

/**
 * A store's square: its logo when the Catalog ships one for `catalogKey`
 * (APP-154), otherwise its brand colour with a monogram. A logo that fails to
 * load falls back to the monogram too.
 *
 * The monogram is always hidden from screen readers. The logo has an alt
 * text, unless `decorative`: inside a link or button already named after the
 * store, a second "Albert Heijn" would only repeat it.
 */
export function StoreTile({
  name,
  color,
  catalogKey,
  decorative = false,
  size = 'medium',
}: {
  name: string
  color?: string
  catalogKey?: string
  decorative?: boolean
  size?: keyof typeof SIZES
}) {
  const messages = useMessages()
  const logo = retailerLogoImage(catalogKey)
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const background = color ?? DEFAULT_STORE_COLOR
  const frame = `${SIZES[size].box} grid shrink-0 place-items-center overflow-hidden rounded-[var(--app-radius)] border border-[var(--app-border)]`

  if (logo && logo.src !== failedSrc) {
    return (
      <span
        aria-hidden={decorative || undefined}
        className={frame}
        style={{ backgroundColor: background }}
      >
        <img
          src={logo.src}
          srcSet={logo.srcSet}
          sizes={SIZES[size].px}
          alt={fmt(messages.loyaltyCards.logoAlt, { store: name })}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          onError={() => setFailedSrc(logo.src)}
        />
      </span>
    )
  }

  return (
    <span
      aria-hidden="true"
      className={`${frame} font-bold tracking-tight`}
      style={{ backgroundColor: background, color: textOnBrand(background) }}
    >
      {storeMonogram(name)}
    </span>
  )
}
