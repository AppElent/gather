/**
 * Local verification contact sheet. NEVER uploaded — it exists so every card
 * can be eyeballed in one screenshot per scheme instead of forty navigations.
 *
 *   node .ds-sync/sheet.mjs light > .ds-sync/sheet-light.html
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { COMPONENTS } from './components.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const scheme = process.argv[2] === 'dark' ? 'dark' : 'light'
const suffix = scheme === 'dark' ? '.dark' : ''

const cells = COMPONENTS.map((c) => {
  const src = `../ds-bundle/components/${c.group}/${c.name}/${c.name}${suffix}.html`
  return `<figure>
    <figcaption>${c.name} <small>${c.group}</small></figcaption>
    <iframe src="${src}" loading="eager" title="${c.name}"></iframe>
  </figure>`
}).join('\n')

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>gather mobile — ${scheme} contact sheet</title>
    <style>
      body {
        margin: 0;
        padding: 16px;
        background: ${scheme === 'dark' ? '#0a0b0a' : '#dcdcd8'};
        color: ${scheme === 'dark' ? '#eef0ed' : '#1f2421'};
        font: 13px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 14px;
      }
      figure { margin: 0; display: flex; flex-direction: column; gap: 5px; }
      figcaption { font-weight: 700; }
      small { opacity: 0.55; font-weight: 400; }
      iframe {
        width: 100%;
        height: 400px;
        border: 1px solid ${scheme === 'dark' ? '#2f3431' : '#b9b9b4'};
        border-radius: 6px;
        background: ${scheme === 'dark' ? '#121413' : '#faf9f7'};
      }
    </style>
  </head>
  <body>
${cells}
  </body>
</html>
`

writeFileSync(join(HERE, `sheet-${scheme}.html`), html)
console.log(`sheet-${scheme}.html — ${COMPONENTS.length} cards`)
