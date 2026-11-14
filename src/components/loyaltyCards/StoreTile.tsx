import {
  DEFAULT_STORE_COLOR,
  storeMonogram,
  textOnBrand,
} from '@gather/core/loyalty-cards'

const SIZES = {
  small: 'h-10 w-10 text-sm',
  medium: 'h-14 w-14 text-lg',
  large: 'h-16 w-16 text-xl',
} as const

/**
 * A store's square: its brand colour with a monogram, until real logos land
 * (APP-140). Decorative: the store's name always sits beside it as text.
 */
export function StoreTile({
  name,
  color,
  size = 'medium',
}: {
  name: string
  color?: string
  size?: keyof typeof SIZES
}) {
  const background = color ?? DEFAULT_STORE_COLOR
  return (
    <span
      aria-hidden="true"
      className={`${SIZES[size]} grid shrink-0 place-items-center rounded-[var(--app-radius)] font-bold tracking-tight shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)]`}
      style={{ backgroundColor: background, color: textOnBrand(background) }}
    >
      {storeMonogram(name)}
    </span>
  )
}
