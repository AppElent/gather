// Draws the DEV and PREVIEW labels onto copies of the app icon, for the
// install variants in app.config.ts (the mobile-distribution standard). Rerun
// after changing icon.png or android-icon-foreground.png, and commit the output:
//
//   node apps/mobile/scripts/badge-icons.mjs   (from the repo root)
//
// iOS gets a full-width band at the bottom and stays opaque. Android gets a
// pill inside the adaptive icon's circular safe zone, since launchers mask the
// corners. Same geometry and colours as the other AppElent apps.
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const images = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'images')

const VARIANTS = [
  { suffix: 'dev', label: 'DEV', fill: '#FF9C4C' },
  { suffix: 'preview', label: 'PREVIEW', fill: '#7FBAFF' },
]

/** Boxes on a 1024 grid measured from the top. */
const SHAPES = {
  ios: { x: 0, y: 832, width: 1024, height: 192, fontSize: 104, radius: 0, stroke: 0 },
  android: { x: 382, y: 726, width: 260, height: 64, fontSize: 40, radius: 32, stroke: 8 },
}

function overlay({ label, fill }, shape, size) {
  const { x, y, width, height, fontSize, radius, stroke } = shape
  // Cap height ≈ 0.7 em: centre the capitals, not the line box.
  const baseline = y + height / 2 + fontSize * 0.35
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">
  <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${fill}"
    ${stroke ? `stroke="#0A0F1A" stroke-width="${stroke}"` : ''}/>
  <text x="${x + width / 2}" y="${baseline}" text-anchor="middle" fill="#000"
    font-family="-apple-system, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif"
    font-weight="700" font-size="${fontSize}" letter-spacing="${fontSize * 0.04}">${label}</text>
</svg>`)
}

async function badge(name, platform, variant) {
  const source = sharp(join(images, `${name}.png`))
  const { width: size, height } = await source.metadata()
  // The overlay is drawn on a 1024 grid; a smaller source would make sharp refuse it.
  if (size !== 1024 || height !== 1024) throw new Error(`${name}.png must be 1024×1024, got ${size}×${height}`)
  let image = source.composite([{ input: overlay(variant, SHAPES[platform], size) }])
  // App Store icons must not carry an alpha channel.
  if (platform === 'ios') image = image.flatten({ background: '#ffffff' }).removeAlpha()
  const out = join(images, `${name}-${variant.suffix}.png`)
  await image.png().toFile(out)
  console.log(`wrote ${out}`)
}

for (const variant of VARIANTS) {
  await badge('icon', 'ios', variant)
  await badge('android-icon-foreground', 'android', variant)
}
