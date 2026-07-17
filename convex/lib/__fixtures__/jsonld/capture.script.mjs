#!/usr/bin/env node
// Capture the schema.org Recipe JSON-LD block from a recipe page into a
// fixture file next to this script.
// Usage: node convex/lib/__fixtures__/jsonld/capture.script.mjs <url> <fixture-name>
//
// Named with a second dot (capture.script.mjs, not capture.mjs) so Convex's
// bundler skips it as a function entry point — it treats any file whose
// basename contains more than one dot as non-function source, the same rule
// that already exempts every *.test.ts file in this directory tree. Without
// this, `convex dev` tries to bundle this script's `node:fs` import for the
// isolate runtime and fails outright, since this file has no 'use node'
// directive (it isn't a Convex function at all, just a standalone CLI tool).
import { writeFileSync } from 'node:fs'

const [url, name] = process.argv.slice(2)
if (!url || !name) {
  console.error('Usage: node capture.script.mjs <url> <fixture-name>')
  process.exit(1)
}
const res = await fetch(url, {
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
    Accept: 'text/html',
  },
})
if (!res.ok) {
  console.error(`Fetch failed: ${res.status} ${res.statusText}`)
  process.exit(1)
}
const html = await res.text()
const re =
  /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
const blocks = [...html.matchAll(re)].map((m) => m[1].trim())
const recipeBlock = blocks.find((b) => b.includes('"Recipe"'))
if (!recipeBlock) {
  console.error(`No Recipe JSON-LD found (${blocks.length} ld+json blocks)`)
  process.exit(1)
}
writeFileSync(
  new URL(`./${name}.json`, import.meta.url),
  `${JSON.stringify(JSON.parse(recipeBlock), null, 2)}\n`,
)
console.log(`Saved ${name}.json`)
