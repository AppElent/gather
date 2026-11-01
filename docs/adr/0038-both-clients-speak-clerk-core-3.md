---
type: decision
description: Read before changing the web or phone Clerk SDK, or porting auth logic between them.
version: 1.0.0
status: accepted
date: 2026-11-01
---

# Both clients speak Clerk Core 3

The web authenticates through `@clerk/react` and the phone through
`@clerk/expo`; both are Clerk **Core 3**. This replaces
[ADR-0037](0037-the-phone-is-a-clerk-generation-ahead-of-the-web.md), which
accepted the web staying on the deprecated Core 2 `@clerk/clerk-react` because
its forms came from `@appelent/auth`. They no longer do: the forms in
`src/lib/auth/` are app-owned copies of the toolkit's auth examples, so the web
could move without a shared package release.

A form on one client is now a fair reference for the same flow on the other:
calls resolve to `{ error }` instead of throwing, a finished attempt needs
`finalize()`, and `<Show when="signed-in">` replaces `SignedIn`/`SignedOut`.

## Consequences

- Password reset is three calls on both clients: `sendCode()`, `verifyCode()`
  and `submitPassword()`. A rejected password leaves the code spent and
  verified. The phone gives each call its own screen. The web keeps one form
  and, on a retry, resubmits only the password.
- The phone puts Clerk's per-field errors under their fields. The web reads the
  same `{ error }` but shows one banner. That is layout, not vocabulary.
- Unsafe metadata is written with `user.updateMetadata()`, which Clerk merges
  server-side, so the web's theme and language writes no longer spread the
  existing object.
- `convex` still lists `@clerk/clerk-react` as an optional peer; a pnpm
  override keeps it out of the install.
- The Core 2 → Core 3 table in
  [the 2026-08-12 record §7](../records/2026-08-12-mobile-clerk-expo.md) is
  history: it describes the migration, not a live difference.

## Rejected

- Keep the web on Core 2 until `@appelent/auth` ships Core 3
  (AppElent/appelent-packages#15): gather no longer depends on that package,
  and `@clerk/clerk-react` is deprecated and unpatched.
