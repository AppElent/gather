# The phone is a Clerk generation ahead of the web

Status: accepted (2026-08-13)

gather's web app authenticates through `@clerk/clerk-react` ^5.61 — Clerk
**Core 2**. `apps/mobile` authenticates through `@clerk/expo`, which depends on
`@clerk/react` ^6.14 — Clerk **Core 3**. The two clients of the same Clerk
instance speak different dialects of the same flows, and that is accepted
rather than fixed.

The phone had no choice in it. There is no Core 2 Expo package; `@clerk/clerk-expo`
is deprecated in favour of `@clerk/expo`, and the rename *is* the Core 3 move. So
the only real question was what happens to the web, and the answer is: not on
this route.

## Why not converge

Converging means upgrading `@appelent/auth`, not gather. Every Clerk call in
gather's auth surface lives in that package — the four hand-built forms, the
account panel, `clerkErrorMessage()` — and it declares
`@clerk/clerk-react: ^5.61.0` as a **peer dependency**. Changing that is a
breaking change for every Appelent app that installs it, made in a repo this one
does not own.

The mobile shell's destination is that gather runs on a phone. A breaking
release of a shared package, and the re-testing of gather's whole web auth
surface behind it, is not a step on the way there. Putting it on the critical
path would make a running app wait on a package release.

So convergence is tracked as its own effort, on the catalog's board rather than
gather's: **AppElent/appelent-packages#15**.

## Why this is not a free ride

`@clerk/clerk-react` is **deprecated on npm** — the registry's own words are
"This package is no longer supported." This is not a version lag, it is an auth
library that will not be patched. That is the reason this ADR has an end
condition rather than being a shrug.

## The trap, and where the map of it lives

`@appelent/auth`'s form logic reads exactly like a reference implementation for
the mobile screens — same hook names, same concepts, same shape. It is not one.
Copying its control flow and renaming the calls produces code that does not
compile, and worse, code that half-compiles.

The full Core 2 → Core 3 delta is tabulated **once**, in
[`docs/research/mobile-clerk-expo.md` §7](../research/mobile-clerk-expo.md) —
seven rows, sourced from Clerk's own Expo documentation partials. It is not
repeated here and must not be repeated anywhere else; a table that exists in
three places disagrees with itself within a year.

**Every auth screen under `apps/mobile` carries a comment pointing at this ADR
and at §7.** That is the only warning that fires at the moment the trap is
sprung — someone writing a native sign-in screen with the web's version open
beside it. Nothing enforces it.

## Divergence the user can see is allowed, and named

The mobile app follows Core 3's natural shape rather than mirroring the web's,
under the shell's standing rule: **divergence in layout is fine; divergence in
vocabulary is not.** A step count is layout. Nothing here renames Group, Pins,
or All.

**Password reset is three screens on the phone, two on the web.** The web sends
a code, then takes the code and the new password together in a single
`attemptFirstFactor` call. Core 3 has no such call: `sendCode()`,
`verifyCode()` and `submitPassword()` are three.

The reason to take the three rather than collapse them back is **atomicity, not
taste**. Core 2's combined call either succeeded or consumed nothing. Core 3's
`verifyCode()` can succeed and its `submitPassword()` can then be rejected — a
breached or too-short password — leaving the code spent and the password unset.
On one screen that strands a person on a form whose code field no longer means
anything. Across three, the failure lands on the password step, which is where
it belongs, and retrying costs nothing.

**Errors can be per-field on the phone.** Core 3 returns them
(`errors.fields.identifier.message`) where Core 2 threw a single error the web
renders as one banner. The phone puts the message under the field it belongs to.

**`getToken()` throws `ClerkOfflineError` offline** where Core 2 returned
`null`. Not user-visible on its own, but it is the first concrete thing known
about how this app behaves without a network, and whatever answers that question
inherits it.

## What would retire this

Any one of:

- `@appelent/auth` releases a Core 3 version (AppElent/appelent-packages#15) and
  gather adopts it. At that point both clients are Core 3, the table in §7
  describes nothing that exists, and this ADR and the comments pointing at it
  are deleted.
- gather stops using `@appelent/auth` for its web auth screens.
- The mobile app is abandoned, leaving one client and no divergence.

Until one of those happens, this is load-bearing and stays.
