// Prepares the Retailer catalog's logo files from the sources in
// packages/core/src/retailerLogos.ts (APP-154).
//
// For every logo: download the source once, fit it on a square tile (white or
// the entry's background, with its padding), and write a WebP per size to
// packages/core/assets/retailer-logos/. Each file is squeezed until it fits
// RETAILER_LOGO_MAX_BYTES. Files no longer in the manifest are removed.
//
// The WebP files are build products that are committed: no client fetches a
// logo, and CI never needs the network or a rasteriser. Change the manifest,
// re-run, commit what changes:
//
//   node scripts/prepare-retailer-logos.mjs              # every logo
//   node scripts/prepare-retailer-logos.mjs jumbo hema   # just these
//   node scripts/prepare-retailer-logos.mjs --cache dir  # keep downloads in dir
//
// Without --cache the downloads go to a temporary folder that is deleted at the
// end. Node 23.6 or later reads the TypeScript manifest directly.
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const [major, minor] = process.versions.node.split('.').map(Number)
if (major < 23 || (major === 23 && minor < 6)) {
  throw new Error(
    `prepare-retailer-logos needs Node 23.6 or later to read the TypeScript manifest; this is ${process.version}.`,
  )
}
const {
  RETAILER_LOGO_MAX_BYTES,
  RETAILER_LOGO_PADDING,
  RETAILER_LOGO_SIZES,
  RETAILER_LOGOS,
  retailerLogoFileName,
} = await import('../packages/core/src/retailerLogos.ts')

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'packages/core/assets/retailer-logos')
// Wikimedia asks automated clients for a descriptive User-Agent; retailer
// sites often refuse anything that does not look like a browser.
const COMMONS_AGENT = 'GatherLogoPrep/1.0 (https://github.com/AppElent/gather)'
const BROWSER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
const QUALITIES = [86, 80, 72, 64, 56, 48, 40]
const DOWNLOAD_TIMEOUT_MS = 30_000

const args = process.argv.slice(2)
const cacheFlag = args.indexOf('--cache')
const cacheArg = cacheFlag >= 0 ? args.splice(cacheFlag, 2)[1] : undefined
if (cacheFlag >= 0 && (!cacheArg || cacheArg.startsWith('--'))) {
  throw new Error('--cache needs a folder: --cache <dir>')
}
const only = new Set(args)
const keys = Object.keys(RETAILER_LOGOS).filter(
  (key) => only.size === 0 || only.has(key),
)
for (const key of only) {
  if (!(key in RETAILER_LOGOS)) throw new Error(`No logo source for ${key}`)
}

const cacheDir =
  cacheArg ?? (await mkdtemp(join(tmpdir(), 'gather-retailer-logos-')))
await mkdir(cacheDir, { recursive: true })
await mkdir(outDir, { recursive: true })

/** The source file's bytes, downloaded once into the cache folder. */
async function source(key, url) {
  // Keyed by URL, so pointing an entry at a new file downloads it again.
  const hash = createHash('sha256').update(url).digest('hex').slice(0, 16)
  const cached = join(cacheDir, `${key}-${hash}`)
  try {
    return await readFile(cached)
  } catch {}
  const commons = new URL(url).host === 'upload.wikimedia.org'
  const response = await fetch(url, {
    headers: { 'User-Agent': commons ? COMMONS_AGENT : BROWSER_AGENT },
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  })
  const type = response.headers.get('content-type') ?? ''
  if (!response.ok || type.includes('html')) {
    throw new Error(`${key}: ${url} answered ${response.status} ${type}`)
  }
  const bytes = Buffer.from(await response.arrayBuffer())
  await writeFile(cached, bytes)
  return bytes
}

/** One square WebP tile at `size`, as small as it needs to be. */
async function tile(bytes, size, { background = '#ffffff', padding }) {
  const inner = Math.round(size * (1 - 2 * padding))
  // Draw a vector source at about 1024px on its long side: sharp enough to
  // trim and downscale, whatever units the SVG's own size is in.
  const { width = 1, height = 1, format } = await sharp(bytes).metadata()
  const density =
    format === 'svg' ? (72 * 1024) / Math.max(width, height) : undefined
  let logo = sharp(bytes, { density, limitInputPixels: false }).ensureAlpha()
  // A wordmark's own margins differ per file; trimming makes padding mean the
  // same thing for all of them. A square icon keeps its designed margins.
  if (padding > 0) logo = logo.trim()
  const fitted = await logo
    .resize(inner, inner, { fit: 'contain', background: '#00000000' })
    .png()
    .toBuffer()
  const flat = await sharp({
    create: { width: size, height: size, channels: 4, background },
  })
    .composite([{ input: fitted, gravity: 'center' }])
    .flatten({ background })
    .png()
    .toBuffer()
  for (const quality of QUALITIES) {
    const webp = await sharp(flat)
      .webp({ quality, effort: 6, smartSubsample: true })
      .toBuffer()
    if (webp.length <= RETAILER_LOGO_MAX_BYTES) return webp
  }
  throw new Error(`still over ${RETAILER_LOGO_MAX_BYTES} bytes at ${size}px`)
}

let total = 0
try {
  for (const key of keys) {
    const entry = RETAILER_LOGOS[key]
    const bytes = await source(key, entry.url)
    const padding = entry.padding ?? RETAILER_LOGO_PADDING
    for (const size of RETAILER_LOGO_SIZES) {
      const webp = await tile(bytes, size, { ...entry, padding })
      await writeFile(join(outDir, retailerLogoFileName(key, size)), webp)
      total += webp.length
    }
  }
} finally {
  if (!cacheArg) await rm(cacheDir, { recursive: true, force: true })
}

if (only.size === 0) {
  const wanted = new Set(
    Object.keys(RETAILER_LOGOS).flatMap((key) =>
      RETAILER_LOGO_SIZES.map((size) => retailerLogoFileName(key, size)),
    ),
  )
  for (const file of await readdir(outDir)) {
    if (!wanted.has(file)) await rm(join(outDir, file))
  }
}
console.log(
  `prepare-retailer-logos: ${keys.length} logos, ${(total / 1024).toFixed(1)} KB`,
)
