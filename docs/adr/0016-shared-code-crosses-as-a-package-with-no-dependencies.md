# Shared code crosses as a package with no dependencies

Status: decided, not yet implemented (2026-08-13)

`apps/mobile` needs gather's Module registry, its message trees and a handful of
domain unions — code the web app already has, in `src/lib/`. It reaches them
through a new workspace package, **`@gather/core`, shipping raw TypeScript and
declaring no dependencies at all**.

The alternative was much cheaper: an `exports` map on the root package, naming
the same files, with no new package to create and no imports to re-point. It
lost anyway, and the reason is the whole content of this ADR.

## The boundary is a fact, not a convention

Under pnpm's **isolated** node linker, a package whose `dependencies` list is
empty has no `@tanstack/react-router` in its `node_modules`, no `react`, no
`convex`, no Tailwind. An import of any of them does not resolve. Not
discouraged — **absent**.

An `exports` map on the root package can only *describe* an intended boundary.
The files it names still sit inside a package that depends on the entire web
stack, so every one of them may import the router tomorrow and nothing anywhere
will say so. The map documents a rule; `dependencies: {}` **is** the rule.

This is invisible in the finished code, which is why it needs an ADR. A reader
sees a workspace package and a few imports and has no way to tell that the empty
dependency list is load-bearing. "Simplify this to a path alias" or "just use
`exports`" are reasonable-sounding suggestions that give up the only property
the package was chosen for, and this file is what refutes them.

## The shape: `core → nothing`

```
convex → core      web → core      mobile → core      core → nothing
```

No cycles, and **core has no outward edges** — that last clause is the design,
not a happy accident. Achieving it cost one move that would otherwise look
arbitrary: **five domain unions were hoisted out of `convex/lib` into
`@gather/core/domain`** — `BABY_EVENT_TYPES`, `NUTRIENT_KEYS` /
`NutritionSource`, `MEAL_NAMES` and `QUANTITY_UNITS` — with `convex/lib/*`
re-exporting them from there, so every backend consumer is untouched and the
`v.union(...)` validators stay where they are.

They had to move because three message files reach into `convex/lib/` to key
themselves by those unions. Leaving that reach in place and re-aiming the
relative paths would have worked — they are `import type`, so Metro never sees
them, only `tsc` does — and it would have made `dependencies: {}` a fiction:
core would be DOM-free and backend-free **by file location rather than by
declaration**, which is exactly the property it was chosen to avoid relying on.

`ModuleId` is already the exemplar of the shape — a union that lives in shared
code and keys `messages/*/modules.ts`. These five are the same thing, parked in
the backend only because a schema validator needed them there;
[ADR-0011](0011-the-ui-is-english-at-the-source-and-translations-are-typed-dictionaries.md)
already moved their *display strings* out for the same reason.

What crosses is the smallest set the mobile shell renders: the 13-Module
registry, `pins.ts`, the catalog↔message-tree join (`moduleText`), the five
domain unions, both locales of the message tree, and four pure i18n helpers —
`fmt`, `isLocale`, `resolveLocale`, `plural`. What does not cross:
`groupPaths.ts`, `appNavigation.ts`'s `NavItem` / `NavDestination`,
`createI18n`, and the rest of `src/lib/`.

**Joined later, in [#161](https://github.com/AppElent/gather/issues/161):**
`landingGroupSlug` — which was `src/lib/landingGroup.ts` and moved wholesale —
plus `selectGroup`, which validates a retained slug against the Member's Groups
and falls back to the landing Group. Exactly the shape this ADR predicts: which
Group a client opens in when nothing has named one is a rule that **drifts
invisibly** if each client owns a copy, and it is pure TypeScript with nothing to
import. The web reads it from a URL that named no Group, the phone from a slug it
retained across a launch (ADR-0015); the answer has to be the same one.

## Two boundaries, one rule each

- **Hand-written shared logic crosses only via `@gather/core`.**
- **Generated backend stubs cross by relative path.**

`convex/_generated/api` cannot be a bare specifier — it collides with the npm
package `convex` — and the web app already imports it by deep relative path at
**41 sites**. That is gather's established idiom, not a hole this decision
opens, and it would be odd to hold the phone to a stricter rule than the web.

The distinction is principled rather than pragmatic. What justified
`@gather/core` was stopping arbitrary web code from leaking onto the phone. A
generated API stub is not web code: it is a machine-written client for a backend
both clients talk to over the wire, and it cannot accidentally drag in Tailwind
or `@tanstack/react-start`. A looser boundary is the right one for it.

**Therefore `convex/` does not move.** This is the part most likely to be
"corrected" later by someone following Convex's own monorepo template, which
puts the backend in `packages/backend`. That is the better long-term shape and
was rejected as out of proportion here: 77 relative import sites in `src/`, the
deploy and seed scripts, `ci.yml`, `preview.yml`, and a `convex.json` that does
not exist yet. Moving it is a decision on its own merits, not a tidy-up of this
one.

## How it is enforced

Enforcement is the decision, so the mechanisms are part of the record:

- **`dependencies: {}` under the isolated linker.** Free — it is just how the
  `package.json` is written.
- **A narrow `exports` map with explicit subpaths and no `./*` wildcard.**
  Widening the shared surface becomes a reviewable line in `package.json`
  instead of an invisible new import in a diff.
- **`packages/core/tsconfig.json` with `lib: ["ES2022"]` and `types: []`,
  typechecked in `ci.yml`.** The only mechanism that catches a *type-level* DOM
  reach, which a test run cannot see unless some test happens to execute that
  line.
- **A third Vitest project, `core`, on `environment: 'node'`.** The root config
  has `web` (jsdom) and `convex` (edge-runtime) and **neither glob covers
  `packages/`**, so the registry, pins and ADR-0011 parity tests would otherwise
  have silently stopped running. Running them under `node` makes the DOM-free
  claim **continuously tested rather than asserted**: the day someone reaches
  for `document.cookie` inside core, CI says so on the web app's own test run,
  long before an emulator does.

A Biome `noRestrictedImports` override was considered and **declined** as
redundant with the first mechanism — with one caveat recorded below, because it
is the one mechanism that would survive losing the isolated linker.

The package ships **raw `.ts` with no build step**; `exports` points straight at
`./src/*.ts`. No stale `dist/`, Fast Refresh crosses the boundary, and the root
Vitest tests the real source. esbuild and Metro both consume `.ts` natively. The
cost — three consumers typechecking the same source under three tsconfigs — is
paid by the package's own authoritative tsconfig and CI typecheck, which was
already an enforcement mechanism. It falls the safe way: `expo/tsconfig.base`
does not set `verbatimModuleSyntax` while the root tsconfig does, so source
written under the strict rules typechecks under the looser ones, not the
reverse.

## What belongs in core

> **Core holds what two clients must agree on and cannot diverge safely.**

This is the sentence future contributors will reach for, so it is stated once,
here. A module name drifts **invisibly** — the web works perfectly and the phone
quietly lacks a Module. A colour drifts **on screen**, immediately, where a
human sees it. That is why 2,536 lines of message tree and the Module registry
are in, and why `groupPaths.ts` is out.

It is already load-bearing beyond this decision:
[ADR-0017](0017-the-phone-owns-its-look-and-shares-its-words.md) used it to
split the design tokens, putting the four Module-group tints in core — keyed by
a union core already owns — and leaving neutrals, radii and type to the phone.

Two constraints follow from the shape and bind anything proposed for core
later. **Core has no dependencies and no build step**, so only plain data with
zero imports can live there; a styling library's config file structurally
cannot. And **the web's tokens are CSS custom properties and stay that way**, so
a TypeScript module in core is a *second* source of truth for anything the web
already expresses in CSS unless something generates one from the other.

## The bite, and where it is written down

The day someone adds a Module they now edit `packages/core/src/modules.ts` and
two message trees **inside a package**, not `src/lib/`. Getting it wrong is
silent in the worst direction: the web works and the phone is missing a Module.

That one line belongs in `CLAUDE.md` rather than here, mirroring how ADR-0011
and ADR-0013 divide the labour — the ADR carries the why and the rejected
alternatives, `CLAUDE.md` carries the instruction that bites. CLAUDE.md's
existing references to `src/lib/i18n/` and `src/lib/modules.ts` become wrong the
moment the files move and are corrected in the same change.

## The accepted cost: gather's web leaves part of `@appelent/i18n`

The four pure helpers live in `@gather/core/i18n` and **both clients use them**.
`@appelent/i18n` exports no `core` subpath — only `.`, `./server`,
`./clerk-sync` and `./test-utils` — so the only way to reach its pure helpers is
through an entry that also carries the DOM path plus `react-dom` and
`@tanstack/react-start` peers. There was never a clean seam, and
[#150](https://github.com/AppElent/gather/issues/150) had already decided
`apps/mobile` takes no dependency on the package at all.

Leaving it there would mean **two `plural()` implementations that must agree
about the same shared message trees** — trees that now live in core. Putting the
helpers in core makes that problem not exist rather than managing it. The
web-side swap is three import sites; the 41 files that call `fmt`/`plural`
import them from `#/lib/i18n` and are untouched. `createI18n` and
`createLanguageSync` still come from `@appelent/i18n` for the web.

Stated plainly: **gather's web stops using part of a shared Appelent package,
diverging from other Appelent apps, for no web-side benefit.** Taken because a
single implementation of a rule both clients depend on is worth more than
uniformity with sibling apps. It does not obsolete
**AppElent/appelent-packages#16** — `@appelent/i18n`'s unguarded
`Intl.PluralRules` remains a real bug for any other app that meets Hermes.

## The initially unverified assumption

**Verified (2026-08-14):** after the extraction, `pnpm exec convex dev --once`
completed successfully against the development deployment. Convex accepts the
workspace package in both its bundle and typecheck path, so the fallback below
is not needed.

**Whether `convex deploy` accepts a `workspace:*` package was initially
unverified.** Convex runs its own esbuild bundle *and* its own `tsc` against
`convex/tsconfig.json`, independently of `pnpm typecheck` — so a green typecheck
is not evidence either way. The domain-union hoist puts `convex/lib/*` on the
far side of that boundary, which makes this the one assumption that can
invalidate the shape above.

Verify with a single `pnpm exec convex dev --once` immediately after the move,
before building anything on top of it.

**Fallback if it balks:** leave `convex/lib/*` as the source of the five unions
and re-aim the three message files' relative paths for the new depth. They are
`import type`, so nothing breaks at runtime — core's `dependencies: {}` simply
becomes a weaker claim, true by file location rather than by declaration.

A second risk is inherited rather than created here:
[#138](https://github.com/AppElent/gather/issues/138) flagged that React Native
may force a repo-wide `nodeLinker: hoisted`. If that ever fires, `@gather/core`
would resolve `@tanstack/react-router` from a hoisted root `node_modules` and
**nothing would say so**. The declined Biome rule is the one listed mechanism
that survives it — worth revisiting *if* that happens, not before.
