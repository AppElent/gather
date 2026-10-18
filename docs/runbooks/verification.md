---
type: runbook
description: Read when running gather's checks, starting the web app, or verifying a web change.
version: 1.0.0
---

# Verify gather

Binds the shared [verification](../standards/verification.md) standard. The
`verify` skill's route→Module map is in [`.claude/skills/verify`](../../.claude/skills/verify/SKILL.md);
phone changes continue in [mobile verification](mobile-verification.md).

## Checks

From the repository root:

```sh
pnpm check
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @gather/mobile typecheck
```

`pnpm test` runs the `web`, `convex`, `core` and `mobile` Vitest projects.
CI (`.github/workflows/ci.yml`) runs `check`, `env:check`, `typecheck`, `test`
and `build` on pull requests only; `main` is gated by the same suite in
`deploy.yml`'s `checks` job.
Toolkit-owned `scripts/` files and `docs/standards/` are excluded from Biome
and `tsc`. When a gate is already red on `main`, compare against the base
commit and report the pre-existing failures with evidence.

## Web runtime

`pnpm dev:watch` runs Vite with continuous Convex sync; `pnpm dev:all` pushes
once. Confirm which Convex deployment `.env.local` points at before runtime
writes: worktrees share the main checkout's dev deployment. Test login needs a
`pk_test_…` Clerk key and `VITE_TEST_USER_*`; Settings → Sample data (dev and
previews) loads the Sample household around the signed-in account.

Documentation-only changes need the checks and a link check, not a runtime pass.
