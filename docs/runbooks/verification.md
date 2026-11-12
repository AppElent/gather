---
type: runbook
description: Read when running gather's checks, starting the web app, or verifying a web change.
version: 1.1.0
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

It does not build. Run `pnpm build` separately when a change touches the build,
Vite config, or anything CI's `build` step would catch.

`pnpm test` runs the `web`, `convex`, `core` and `mobile` Vitest projects.
CI (`.github/workflows/ci.yml`) runs `env:check`,
`check-project.mjs --strict`, `pnpm verify` and `pnpm build` on pull requests
only; `main` is gated by the same suite in `deploy.yml`'s `checks` job.
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
