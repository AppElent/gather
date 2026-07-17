#!/usr/bin/env node
// Capture the schema.org Recipe JSON-LD block from a recipe page into a
// fixture file next to this script.
// Usage: node convex/lib/__fixtures__/jsonld/capture.mjs <url> <fixture-name>
import { writeFileSync } from 'node:fs'

const [url, name] = process.argv.slice(2)
if (!url || !name) {
  console.error('Usage: node capture.mjs <url> <fixture-name>')
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
