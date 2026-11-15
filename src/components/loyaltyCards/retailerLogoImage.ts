import {
  RETAILER_LOGO_SIZES,
  retailerLogoFileName,
  retailerLogoKey,
} from '@gather/core/retailer-logos'

// Every shipped logo file, as a hashed asset URL. `no-inline` keeps Vite from
// turning the small ones into data URLs inside this chunk: a logo is fetched
// only when a tile shows it.
const FILES = import.meta.glob<string>(
  '/packages/core/assets/retailer-logos/*.webp',
  { eager: true, query: '?no-inline', import: 'default' },
)

const DIRECTORY = '/packages/core/assets/retailer-logos/'

export interface RetailerLogoImage {
  src: string
  srcSet: string
}

/**
 * The `<img>` sources for a card's or Catalog entry's logo, or null for the
 * monogram: a custom store, a dangling Provenance, or a missing file.
 */
export function retailerLogoImage(
  catalogKey: string | null | undefined,
): RetailerLogoImage | null {
  const key = retailerLogoKey(catalogKey)
  if (!key) return null
  const urls = RETAILER_LOGO_SIZES.map(
    (size) => FILES[`${DIRECTORY}${retailerLogoFileName(key, size)}`],
  )
  if (urls.some((url) => !url)) return null
  return {
    src: urls[0],
    srcSet: urls
      .map((url, index) => `${url} ${RETAILER_LOGO_SIZES[index]}w`)
      .join(', '),
  }
}
