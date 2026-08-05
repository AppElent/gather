// Rasterises the app icons in public/ from the two hand-authored SVG sources.
//
// public/favicon.svg   — the mark on a rounded tile. Source for the browser
//                        favicon and the PWA icons.
// public/maskable.svg  — the same mark full-bleed on a square. Source for
//                        anything the platform masks itself: Android's
//                        maskable slot, and apple-touch-icon (iOS applies its
//                        own squircle and renders alpha as black, so it wants
//                        an opaque square, not our rounded tile).
//
// The PNG/ICO outputs are build products that happen to be committed — CI and
// the Cloudflare deploy must never need a rasteriser. Edit an SVG, re-run
// `pnpm run generate-icons`, commit what changes.
import { Buffer } from "node:buffer";
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const publicDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const source = (name) => join(publicDir, name);

/** Renders one SVG to a square PNG buffer at `size`. */
const render = (svg, size) =>
	sharp(source(svg), { density: 384 }).resize(size, size).png().toBuffer();

/**
 * Packs PNG buffers into an .ico container.
 *
 * ICONDIR (6 bytes) + one ICONDIRENTRY (16 bytes) per image + the PNG payloads
 * appended verbatim. PNG-encoded ICO entries are understood by every browser
 * we target, so no BMP re-encoding is needed. A width or height of 256 is
 * stored as 0 — the field is a single byte.
 */
function packIco(images) {
	const header = Buffer.alloc(6);
	header.writeUInt16LE(0, 0); // reserved
	header.writeUInt16LE(1, 2); // 1 = icon
	header.writeUInt16LE(images.length, 4);

	const directory = Buffer.alloc(16 * images.length);
	let offset = header.length + directory.length;

	images.forEach(({ size, data }, index) => {
		const entry = index * 16;
		directory.writeUInt8(size % 256, entry + 0); // width
		directory.writeUInt8(size % 256, entry + 1); // height
		directory.writeUInt8(0, entry + 2); // palette size (0 = truecolour)
		directory.writeUInt8(0, entry + 3); // reserved
		directory.writeUInt16LE(1, entry + 4); // colour planes
		directory.writeUInt16LE(32, entry + 6); // bits per pixel
		directory.writeUInt32LE(data.length, entry + 8);
		directory.writeUInt32LE(offset, entry + 12);
		offset += data.length;
	});

	return Buffer.concat([header, directory, ...images.map((i) => i.data)]);
}

const written = [];

const png = async (svg, size, name, { opaque = false } = {}) => {
	let pipeline = sharp(source(svg), { density: 384 }).resize(size, size);
	if (opaque) pipeline = pipeline.flatten({ background: "#e7f3ec" });
	const data = await pipeline.png().toBuffer();
	await writeFile(join(publicDir, name), data);
	written.push(`${name} (${size}x${size}, ${(data.length / 1024).toFixed(1)} KB)`);
};

await png("favicon.svg", 64, "pwa-64x64.png");
await png("favicon.svg", 192, "pwa-192x192.png");
await png("favicon.svg", 512, "pwa-512x512.png");
await png("maskable.svg", 512, "maskable-icon-512x512.png");
await png("maskable.svg", 180, "apple-touch-icon.png", { opaque: true });

const icoSizes = [16, 32, 48];
const ico = packIco(
	await Promise.all(
		icoSizes.map(async (size) => ({
			size,
			data: await render("favicon.svg", size),
		})),
	),
);
await writeFile(join(publicDir, "favicon.ico"), ico);
written.push(`favicon.ico (${icoSizes.join("/")}, ${(ico.length / 1024).toFixed(1)} KB)`);

console.log(`generate-icons: wrote ${written.length} files to public/`);
for (const line of written) {
	console.log(`  ${line}`);
}
