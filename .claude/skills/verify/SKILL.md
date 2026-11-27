---
name: verify
description: Verify that a code change actually does what it's supposed to by exercising it end-to-end and observing behavior — drive the affected flow, not just tests or typecheck. Run before committing nontrivial changes to gather.
---

# Verify (gather)

Checks, web runtime and backend identity: [verification runbook](../../../docs/runbooks/verification.md).
Phone changes: [mobile verification](../../../docs/runbooks/mobile-verification.md).

Local-first. Always run the same static checks as the CI `check` job, in this order:

1. `pnpm run env:check`
2. `node scripts/check-project.mjs --strict`
3. `pnpm verify` (`pnpm check`, root and Convex typecheck, mobile typecheck, tests)
4. `pnpm build`

Do not pick individual checks instead: `pnpm verify` is the one list, so it stays in
step with CI. On web (no dev server / no Convex+Clerk runtime creds), these static checks
are the fallback; otherwise also drive the flow below.

## Routes

Web routes live under `src/routes/` (`_app.tsx` is the signed-in shell); each
Module's status (live or placeholder) is in `packages/core/src/modules.ts`.

## Auth note

The sign-in screen's "▶ Dev: log in as test user" button is
`src/lib/auth/TestLoginButton.tsx` and appears only when `VITE_CLERK_PUBLISHABLE_KEY` is a `pk_test_...`
key **and** both `VITE_TEST_USER_EMAIL`/`VITE_TEST_USER_PASSWORD` are set. If it's
missing, check `.env.local` before concluding the app can't be tested logged-in.

gather's sign-in flow (`src/routes/sign-in.tsx`) renders `src/lib/auth`'s
`SignInForm`, which includes the `TestLoginButton`.

## What to drive

1. Start the dev server (`.claude/launch.json` → `dev:watch`, needs both Convex and Vite).
2. Log in via the test-login button (see above) or an already-authenticated session.
3. For a change to a live Module: exercise the actual CRUD flow the change
   touches (create, edit, delete; join or leave a group), not just a page load.
4. For a change to a placeholder Module: confirm it still renders the placeholder
   shell without erroring.
5. Check the browser console and network tab for errors introduced by the change.
