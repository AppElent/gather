# Group search — design canvas

The mobile Group search design for [#205](https://github.com/AppElent/gather/issues/205).

**Canvas:** https://claude.ai/code/artifact/1af52974-31fc-4b7d-8b32-b45a07c84abb

## What is in here

The source of the canvas, one file per artboard, plus the layout manifest. These
are the working files: the published canvas is *built* from them, so a change
starts here and never in the published page.

| File | Artboard |
| --- | --- |
| `Recents.dc.html` | Search entered, field empty — device-local Recent records |
| `Main.dc.html` | A ranked result list, query `Comté` |
| `Loading.dc.html` | A query in flight — skeleton rows, no stale results |
| `NoResults.dc.html` | Nothing found, with the Clear action |
| `Unavailable.dc.html` | Gather's Unavailable state with Retry |
| `ResultsDark.dc.html` | `Main` in the phone's dark tokens |
| `Anatomy.dc.html` | Row anatomy, the five types, ranking tiers, thresholds |
| `canvas.json` | Positions, artboard titles, sticky notes, launch view |

`ResultsDark.dc.html` is derived from `Main.dc.html` by token substitution, not
drawn separately — when `Main` changes, regenerate it rather than editing both.

## Rebuilding and republishing

`.dc.html` is Claude Design's Design Component format. Editing the files by hand
is fine; rebuilding the canvas needs the `design` skill's seeding helper, which
ships with Claude Code rather than living in this repo. Ask Claude to "update the
Group search design canvas" and it will re-seed from these files and republish to
the same URL.

The built page is ~2 MB (it embeds the canvas editor), so it is deliberately not
committed.

## The values in here are lifted, not invented

Colours, type sizes and geometry come from the phone's own source and must stay
in step with it:

- Neutrals and radii — `apps/mobile/src/theme/tokens.ts`
- The four group tints, light and dark — `packages/core/src/module-tints.ts`
- Row and card geometry — `apps/mobile/src/modules/notes/NotesScreen.tsx`,
  `apps/mobile/src/modules/tasks/components.tsx`
- The badge pill — `apps/mobile/src/modules/recipes/CollectionScreen.tsx`
- Skeleton geometry — `apps/mobile/src/components/LoadingSkeleton.tsx`
- Unavailable copy — `t.gate` in `apps/mobile/src/i18n/messages/en.ts`

Sample content is the seeded Willow Street household
(`convex/lib/seed/sampleHousehold.ts`), with Calendar and a few Comté records
invented — that Module does not exist yet.

## Chrome

The field is the tab bar. On iOS 26 the Search tab carries `role: 'search'`
(`apps/mobile/src/shell/tabs.ts`), so its capsule expands in place: the bar
becomes a full-width field and the capsule becomes a close button. There is no
header search and no Cancel. Per `docs/mobile-interaction.md` no artboard draws
the status bar or the keyboard, so each one shows the moment the keyboard has
been dismissed and the field has settled to the bottom.

## Open questions, also on the canvas as sticky notes

- A tasting row's badge shows the Kind (`Cheese`), so the spec's "context = Kind"
  would repeat it. Drawn as title + badge, no context line.
- The native field carries its own clear button, which makes the spec's separate
  **Clear search** action on the no-results state redundant.
