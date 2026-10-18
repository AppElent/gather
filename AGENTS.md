# AGENTS.md

Read `CLAUDE.md` for all project conventions (pnpm always, Biome, commands, testing).

## Upgrading dependencies

Follow the steps in `.claude/commands/upgrade-deps.md` (readable as plain markdown).
Never weaken or skip tests to make an upgrade pass; stop and report instead.

## Running and verifying the mobile app

`apps/mobile` is built and driven with two things, neither of them a local script:

- **A development build** — `pnpm --filter @gather/mobile devbuild:android` once,
  then `pnpm --filter @gather/mobile start:dev-client` for every session after.
  Rebuild only on native dependency, `app.json`, or config-plugin changes.
- **[`agent-device`](https://github.com/callstack/agent-device)** for emulator and
  app automation — installed globally, shared by every mobile project. Android app
  id `com.appelent.gather`, scheme `gather://`, AVD `Pixel_9_Pro`, Metro `--kind expo`.

**Verify a mobile change on the device, not with `typecheck` alone.** `open`, then
`press`/`fill`/`scroll --settle` reading the UI diff each action returns, then
`wait text "..."` to assert the end state — a screenshot on its own is not
verification. Command table and the full loop are in `apps/mobile/README.md`.

Selector note: the UI is translated, so `text` selectors are locale-dependent
(`Recepten`, not `Recipes`). Prefer `id` selectors; `testID` maps to Android's
`resource-id`.

<!-- appelent-guidelines:start -->
Before implementing or reviewing code, read CODING_STANDARDS.md.
For UI work, also read DESIGN_SYSTEM.md. Follow their task-specific links.
<!-- appelent-guidelines:end -->
