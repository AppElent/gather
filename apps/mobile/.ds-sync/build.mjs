/**
 * Generates the claude.ai/design upload layout for gather's mobile design
 * system.
 *
 * Off-script by necessity: `apps/mobile` is an Expo / React Native app with no
 * Storybook and no compiled `dist/`, so neither converter shape applies. What
 * this produces is the same *format* the converter produces — the format is the
 * contract — built straight from `apps/mobile/src` through react-native-web.
 *
 * Run from `apps/mobile`:  node .ds-sync/build.mjs
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { COMPONENTS, GROUPS } from './components.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const MOBILE = resolve(HERE, '..')
const OUT = join(MOBILE, 'ds-bundle')
const GLOBAL_NAME = 'GatherMobile'

/**
 * The esbuild executable.
 *
 * Not `node_modules/.bin/esbuild` — on Windows that is a shell script, which
 * `execFileSync` cannot spawn (ENOENT, misleadingly). The real binary lives in
 * the platform package, so ask Node to resolve it the way esbuild itself does.
 */
function esbuildBinary() {
  const root = resolve(MOBILE, '../..')
  const candidates = [
    join(root, 'node_modules/.bin/esbuild.exe'),
    join(root, 'node_modules/.bin/esbuild.cmd'),
    join(root, 'node_modules/.bin/esbuild'),
  ]

  const pnpmDir = join(root, 'node_modules/.pnpm')
  if (existsSync(pnpmDir)) {
    for (const entry of readdirSync(pnpmDir)) {
      if (!entry.startsWith('@esbuild+')) continue
      const scoped = join(pnpmDir, entry, 'node_modules/@esbuild')
      if (!existsSync(scoped)) continue
      for (const platform of readdirSync(scoped)) {
        candidates.unshift(
          join(scoped, platform, 'bin/esbuild'),
          join(scoped, platform, 'esbuild.exe'),
        )
      }
    }
  }

  const found = candidates.find((candidate) => existsSync(candidate))
  if (!found) throw new Error('esbuild binary not found — run pnpm install')
  return found
}

const ESBUILD = esbuildBinary()

const SHIMS = {
  'react-native': './.ds-sync/shims/react-native.js',
  'expo-router': './.ds-sync/shims/expo-router.jsx',
  'expo-localization': './.ds-sync/shims/expo-localization.js',
  'expo-sqlite/kv-store': './.ds-sync/shims/expo-sqlite-kv.js',
  'expo-splash-screen': './.ds-sync/shims/expo-splash-screen.js',
  '@clerk/expo': './.ds-sync/shims/clerk-expo.jsx',
  'convex/react': './.ds-sync/shims/convex-react.jsx',
}

const RESOLVE_EXTENSIONS = [
  '.web.tsx',
  '.web.ts',
  '.web.jsx',
  '.web.js',
  '.tsx',
  '.ts',
  '.jsx',
  '.js',
  '.mjs',
  '.json',
]

function sha12(text) {
  return createHash('sha256').update(text).digest('hex').slice(0, 12)
}

function write(relPath, contents) {
  const full = join(OUT, relPath)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, contents)
  return full
}

/** The compiled library: every component, the providers, the token layer. */
function buildBundle() {
  const outfile = join(OUT, '_ds_bundle.js')
  mkdirSync(OUT, { recursive: true })

  execFileSync(
    ESBUILD,
    [
      '.ds-sync/entry.jsx',
      '--bundle',
      `--outfile=${outfile}`,
      '--format=iife',
      `--global-name=${GLOBAL_NAME}`,
      '--jsx=automatic',
      ...Object.entries(SHIMS).map(([from, to]) => `--alias:${from}=${to}`),
      `--resolve-extensions=${RESOLVE_EXTENSIONS.join(',')}`,
      '--main-fields=module,browser,main',
      '--define:__DEV__=false',
      '--define:process.env.NODE_ENV="production"',
      // `src/auth/config.ts` *throws* when the publishable key is missing, so a
      // preview must supply one. It is deliberately not a `pk_test_` key: that
      // prefix is what unlocks the dev-login shortcut in `WelcomeActions`, and a
      // design agent should be shown the front door real users get, not the
      // one-tap shortcut a preview build offers.
      `--define:process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_designpreview"`,
      '--define:process.env.EXPO_PUBLIC_TEST_USER_EMAIL=undefined',
      '--define:process.env.EXPO_PUBLIC_TEST_USER_PASSWORD=undefined',
      // Anything else that reaches for `process` at runtime gets an empty env
      // rather than a ReferenceError that takes the whole bundle down.
      '--banner:js=globalThis.process=globalThis.process||{env:{}};',
      '--loader:.js=jsx',
      '--log-level=warning',
    ],
    { cwd: MOBILE, stdio: 'inherit' },
  )

  const source = readFileSync(outfile, 'utf8')
  const stamped = `// @ds-bundle ${GLOBAL_NAME} sha=${sha12(source)}\n${source}`
  writeFileSync(outfile, stamped)
  return sha12(source)
}

/**
 * The page-level stylesheet.
 *
 * Deliberately thin, and that is not an omission: react-native-web compiles
 * every `StyleSheet.create` rule and injects it into the document at runtime,
 * so the component styling ships inside `_ds_bundle.js`. What CSS still has to
 * do is give the page the box model those injected rules assume.
 */
function buildStyles() {
  return `/* gather mobile — page styles.
 *
 * Component styling is NOT here. react-native-web injects it at runtime from
 * _ds_bundle.js, so this file only sets up the page those styles land in.
 * Colours come from the token layer (see tokens/tokens.json and the README):
 * a gather mobile component is styled through \`useTokens()\`, never a class.
 */

html,
body {
  margin: 0;
  padding: 0;
  min-height: 100%;
}

body {
  /* react-native-web maps RN's default font stack to the platform's; matching
   * it here keeps a preview's text metrics equal to the phone's. */
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
    'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* Every specimen root fills its card. RN layout assumes a definite height;
 * without this, flex:1 components collapse to zero. */
#root {
  display: flex;
  min-height: 100vh;
}

#root > * {
  flex: 1;
}
`
}

/** The token layer, emitted as data so it can be read without running the bundle. */
function buildTokens() {
  const tokensSrc = readFileSync(join(MOBILE, 'src/theme/tokens.ts'), 'utf8')
  const tintsSrc = readFileSync(
    resolve(MOBILE, '../../packages/core/src/moduleTints.ts'),
    'utf8',
  )

  const grab = (src, re) => {
    const out = {}
    let m
    while ((m = re.exec(src)) !== null) out[m[1]] = m[2]
    return out
  }

  const scheme = (name) => {
    const block = tokensSrc.split(`${name}: {`)[1]?.split('},')[0] ?? ''
    return grab(block, /(\w+):\s*'(#[0-9a-fA-F]+)'/g)
  }

  const tintBlock = (name) => {
    const block = tintsSrc.split(`${name}: {`)[1]?.split('},')[0] ?? ''
    const out = {}
    let m
    const re = /(\w+):\s*\['(#[0-9a-fA-F]+)',\s*'(#[0-9a-fA-F]+)'\]/g
    while ((m = re.exec(block)) !== null) out[m[1]] = { bg: m[2], fg: m[3] }
    return out
  }

  const radius = {}
  const radiusBlock = tokensSrc.split('export const RADIUS = {')[1]?.split('}')[0] ?? ''
  let rm
  const rre = /(\w+):\s*(\d+)/g
  while ((rm = rre.exec(radiusBlock)) !== null) radius[rm[1]] = Number(rm[2])

  const danger = grab(
    tokensSrc.split('const DANGER = {')[1]?.split('}')[0] ?? '',
    /(\w+):\s*'(#[0-9a-fA-F]+)'/g,
  )

  return {
    neutrals: { light: scheme('light'), dark: scheme('dark') },
    danger,
    radius,
    moduleTints: { light: tintBlock('light'), dark: tintBlock('dark') },
  }
}

/** One preview card per component, per scheme. */
function cardHtml(component, scheme) {
  const depth = '../../../'
  return `<!-- @dsCard group="${component.group}" -->
<!doctype html>
<html lang="en" data-scheme="${scheme}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${component.name} — ${scheme}</title>
    <link rel="stylesheet" href="${depth}styles.css" />
    <style>
      body { background: ${component.pageBg?.[scheme] ?? (scheme === 'dark' ? '#121413' : '#faf9f7')}; }
      #root { padding: ${component.pad ?? 20}px; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script src="${depth}_ds_bundle.js"></script>
    <script>
      (function () {
        var G = window.${GLOBAL_NAME}
        G.mount(document.getElementById('root'), ${component.specimen}, {
          scheme: '${scheme}',
        })
      })()
    </script>
  </body>
</html>
`
}

/**
 * Empty the output directory.
 *
 * Not a plain `rmSync(OUT, { recursive: true })`: on Windows, anything holding a
 * handle inside it — a static server serving previews, a browser with a card
 * open, a virus scanner mid-read — makes removing the *directory itself* fail
 * with EPERM, even though its contents delete fine. Clearing the children and
 * leaving the directory in place sidesteps the whole class of problem, and the
 * result is identical: every file is regenerated below.
 */
function cleanOutDir() {
  if (!existsSync(OUT)) return
  for (const entry of readdirSync(OUT)) {
    rmSync(join(OUT, entry), {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 120,
    })
  }
}

function main() {
  cleanOutDir()
  mkdirSync(OUT, { recursive: true })

  const bundleSha = buildBundle()
  write('styles.css', buildStyles())

  const tokens = buildTokens()
  write('tokens/tokens.json', `${JSON.stringify(tokens, null, 2)}\n`)

  const renderHashes = {}
  for (const component of COMPONENTS) {
    const dir = `components/${component.group}/${component.name}`
    for (const scheme of ['light', 'dark']) {
      const html = cardHtml(component, scheme)
      const suffix = scheme === 'light' ? '' : `.${scheme}`
      write(`${dir}/${component.name}${suffix}.html`, html)
      renderHashes[`${component.name}.${scheme}`] = sha12(html)
    }
    write(`${dir}/${component.name}.d.ts`, component.types)
    write(`${dir}/${component.name}.prompt.md`, component.prompt)
    write(`${dir}/${component.name}.jsx`, component.usage)
  }

  const readmeHeaderPath = resolve(MOBILE, '../../.design-sync/conventions.md')
  const header = existsSync(readmeHeaderPath)
    ? `${readFileSync(readmeHeaderPath, 'utf8').trim()}\n\n---\n\n`
    : ''
  write('README.md', header + buildReadme(tokens))

  write(
    '_ds_sync.json',
    `${JSON.stringify(
      {
        shape: 'custom-react-native-web',
        pkg: 'apps/mobile',
        globalName: GLOBAL_NAME,
        bundleSha12: bundleSha,
        styleSha: sha12(buildStyles()),
        renderHashes,
        components: COMPONENTS.map((c) => `${c.group}/${c.name}`),
      },
      null,
      2,
    )}\n`,
  )

  console.log(
    `built ${COMPONENTS.length} components across ${GROUPS.length} groups -> ds-bundle/`,
  )
}

function buildReadme(tokens) {
  const byGroup = new Map()
  for (const c of COMPONENTS) {
    if (!byGroup.has(c.group)) byGroup.set(c.group, [])
    byGroup.get(c.group).push(c)
  }

  const index = [...byGroup.entries()]
    .map(
      ([group, items]) =>
        `### ${group}\n\n${items
          .map((c) => `- **${c.name}** — ${c.summary}`)
          .join('\n')}`,
    )
    .join('\n\n')

  const tintRows = Object.entries(tokens.moduleTints.light)
    .map(
      ([group, light]) =>
        `| \`${group}\` | \`${light.bg}\` / \`${light.fg}\` | \`${tokens.moduleTints.dark[group].bg}\` / \`${tokens.moduleTints.dark[group].fg}\` |`,
    )
    .join('\n')

  return `# gather — mobile design system

React Native components from \`apps/mobile\`, compiled for the browser through
react-native-web. Everything is on \`window.${GLOBAL_NAME}\`.

## Components

${index}

## Module tints

Four groups, so the thirteen Modules read as four bands rather than confetti.
\`useTokens(group)\` returns the group's accent; \`tokens.tintOf(group)\` returns
its \`{ bg, fg }\` pair.

| Group | Light (bg / fg) | Dark (bg / fg) |
| --- | --- | --- |
${tintRows}

## Radii

${Object.entries(tokens.radius)
  .map(([k, v]) => `- \`RADIUS.${k}\` — ${v}`)
  .join('\n')}

## Neutrals

| Token | Light | Dark |
| --- | --- | --- |
${Object.keys(tokens.neutrals.light)
  .map(
    (key) =>
      `| \`${key}\` | \`${tokens.neutrals.light[key]}\` | \`${tokens.neutrals.dark[key]}\` |`,
  )
  .join('\n')}
`
}

main()
