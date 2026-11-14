---
type: runbook
description: Read when running gather's checks, starting the web app, or verifying a web change.
version: 2.0.0
---

# Verify gather

Binds the shared [verification](../standards/verification.md) standard. The
`verify` skill's route→Module map is in [`.claude/skills/verify`](../../.claude/skills/verify/SKILL.md);
phone changes continue in [mobile verification](mobile-verification.md).

## Checks

From the repository root, run the local gate:

```sh
pnpm verify
```

`pnpm verify` runs, in order and stopping at the first failure:

1. `pnpm check`: `biome check` plus `scripts/check-mobile-structure.mjs`.
2. `pnpm typecheck`: the root `tsc` run (web, Convex, core).
3. `pnpm --filter @gather/mobile typecheck`: the phone app's own `tsconfig`,
   which the root run does not use.
4. `pnpm test`.

It does not build. Always run `pnpm build` after `pnpm verify`, as CI's
`check` job does. To match CI fully, run the same sequence:

```sh
pnpm run env:check
node scripts/check-project.mjs --strict
pnpm verify
pnpm build
```

`pnpm test` runs the `web`, `convex`, `core`, `mobile` and `scripts` Vitest
projects; `scripts` holds the feature-manifest route-drift check.
CI (`.github/workflows/ci.yml`) runs `env:check`,
`node scripts/check-project.mjs --strict`, `pnpm verify` and `pnpm build` on
pull requests only; `main` is gated by the same suite in `deploy.yml`'s
`checks` job.
Toolkit-owned `scripts/` files and `docs/standards/` are excluded from Biome
and `tsc`. When a gate is already red on `main`, compare against the base
commit and report the pre-existing failures with evidence.

## Web runtime

`pnpm dev:watch` runs Vite with continuous Convex sync; `pnpm dev:all` pushes
once. Confirm which Convex deployment `.env.local` points at before runtime
writes: every worktree shares the dev deployment named in Infisical `dev`. Test
login needs a `pk_test_…` Clerk key and `VITE_TEST_USER_*` (local only);
Settings → Sample data (dev, and previews while `enable-sample-data` is `true` in
Infisical `staging`) loads the Sample household around the signed-in account.

Documentation-only changes need the checks and a link check, not a runtime pass.
