---
type: record
kind: research
description: Read when deciding what gather takes from foundry (workouts) and developer-tools; the prioritized backlog behind the 2026-10 onboarding and release work.
version: 1.0.0
date: 2026-10-18
---

# Foundry reuse: prioritized backlog

Synthesis of three read-only research passes. Evidence, SHAs and file paths are in:

- [A — developer-tools onboarding delta](a-onboarding-delta.md)
- [B — foundry change inventory](b-change-inventory.md)
- [C — App Store / Play gap](c-app-store-gap.md)

## Headline

1. **Onboarding replaces CLAUDE.md, not the rules in it.** About 60 % of gather's 431-line
   CLAUDE.md is gather-only invariants (typed registries, Drop, seed, photos, group cascade).
   They move to `CODING_STANDARDS.md` bindings, runbooks and contracts — above all one
   `docs/runbooks/add-a-module.md` that collects the four registries that fail silently.
   About 15 % is covered by developer-tools standards, 15 % is generic and worth upstreaming,
   10 % is stale today. Always-loaded agent context drops from ~470 lines to ~20.
2. **The sync is cheap and proven.** Dry-run on gather: 123 add, 3 update, 1 conflict
   (`scripts/env.mjs`, the same one foundry hit and parked as `env-legacy.mjs`).
3. **Gather is not behind foundry across the board.** Each repo has ~300 commits since
   August. Gather leads on the deletion cascade, ADR-0029, the Drop registry, seeds and
   previews; foundry leads on auth breadth, query caching, release readiness, mobile Sentry.
4. **Store release is mostly config, pages and dashboards**, not code. Gather already has
   compliant in-app account deletion. The blockers are a privacy policy, a web deletion
   route, removing the "Soon" social placeholders, a review account and the store records.

## Backlog

Order is the recommended execution order. W = workstream.

| # | Item | Source | W | Who | Native build? | Effort |
|---|---|---|---|---|---|---|
| 1 | Fix stale CLAUDE.md/ADR facts (deleted `mobile-interaction.md` cited in 8 files, duplicate ADR 0013/0014, wrong seed/env/i18n/migration claims, Windows paths) | A §2.1 | W1 | agent | no | S |
| 2 | Install developer-tools toolkit (sync from GitHub main, park `env.mjs`, prove `env:check` parity) | A §3, §5 PR1 | W1 | agent | no | S |
| 3 | Shrink CLAUDE.md/AGENTS.md; write `CODING_STANDARDS.md` bindings, `DESIGN_SYSTEM.md`, `add-a-module.md` and the runbooks/contracts that receive the KEEP content | A §2.2, §2.4, PR2 | W1 | agent | no | M |
| 4 | Doc restructure: `docs/README.md` index, frontmatter, `CONTEXT.md`→`GLOSSARY.md`, delete executed plans/superpowers/briefs/review-notes | A PR3 | W1b | agent | no | M |
| 5 | Upstream generic rules to developer-tools (one-shot end condition, responsive icon controls + breadcrumbs, i18n key-not-sentence, `eas update --environment`, RN `fetch(file://)` trap, agent-device loop) | A PR5 | W2 | agent, user merges | – | S each |
| 6 | Privacy statement `/privacy` (en/nl) with a deletion-request section; in-app link | C rows 6–7, B 1.11 | W4 | agent drafts, **user approves copy** | no | M |
| 7 | Hide `SocialSoon` placeholders outside `__DEV__` | C row 4 | W4 | agent | no (OTA) | S |
| 8 | `app.json` hygiene: mic/Face ID off, `blockedPermissions`, `locales` purpose strings, `@clerk/expo` `appleSignIn: false` until SIWA ships | C rows 10, 11, 17; B 2.9 | W4 | agent | **yes** | S |
| 9 | CI typechecks `apps/mobile`; Device Hub to devDependencies; `"latest"` ranges → carets | B 2.3, 2.5, 4.1 | W3 | agent | no | S |
| 10 | Convex query retention provider + Biome guard, from developer-tools standard v1.2.2 (key by user + Group) | B 3.1, 3.2 | W3 | agent | no (OTA) | M |
| 11 | AI usage cap + consent for recipe import | B 3.4 | W3 | agent | no | S–M |
| 12 | Drop `@appelent/*` packages (vendor auth/i18n/dev; remove registry token from CI/EAS/hooks) | A PR4, B 1.5 | W3 | agent | yes (EAS hook) | M |
| 13 | Email sign-in code (mobile + web) | B 1.3 | W3 | agent | no | S–M |
| 14 | One native batch: Sign in with Apple + Microsoft, Apple token revocation, mobile Sentry | B 1.1, 1.9, 2.11; C rows 2–3, 24 | W3 | agent + user (Apple/Clerk) | **yes** | L |
| 15 | Store records and forms: Clerk "Delete self" on prod, ASC app + `ascAppId`, Play app + service account, App Privacy / Data safety, age rating, DSA trader, review account, listing | C §4 | W4 | **user** (agent drafts) | – | M |
| 16 | Expo SDK 58 — only after RN 0.88 final and `expo-share-intent` support confirmed | B 2.1 | later | agent | yes | L |
| 17 | Data export (derive from `groupCascade.ts`), `run-mobile` Android driver, mobile Jest | B 1.10, 2.4, 2.2 | later | agent | no | M–L |

Items 8 and 14 both move the fingerprint. Do not hold the first store build for 14: ship 8
on its own. Items 12–14 and 16–17 are not needed for an email-only first release.

## Review corrections (Codex GPT-6-Sol, 2026-10-18)

Spot checks confirmed the central claims, with these corrections and changes to the plan:

- **Store prerequisites run alongside W1, not after W3.** Items 6–8 and 15, mobile CI (9) and
  the review account start now; if the Play account is personal, its 14-day closed-test clock
  starts as soon as an internal build exists.
- **Deletion guard.** `delete.tsx:53–55` allows `deleteSelfEnabled === undefined`, while Convex
  marks the purge before `user.delete()`. Guard on `=== true` (added to W4) and exercise
  deletion on a production-configured review account before submission.
- **Query retention (10) needs a Convex auth gate and backend-identity check first.**
  `GroupProvider` keeps its last list when the query goes undefined and keeps rendering
  children. Gate (B 1.6) moves ahead of 10; verify sign-out and account switch before retention.
- **AI disclosure covers two paths**: recipe URL import and user-entered ingredients through
  `recipeNutrition.estimateNutrition`. A consent sheet is not needed for a public page import;
  consider disclosure at the ingredient action. Item 11 is scoped accordingly.
- **S1 is 41 files, not 8**, including code comments. `SocialSoon` is mobile-only
  (`apps/mobile/app/(auth)/sign-{in,up}.tsx`).
- **AGENTS.md must route every former CLAUDE.md rule within one hop** and drop its current
  "read CLAUDE.md" line, which would loop. W1b deletes selectively; no line-count target.

## Flows the other way (gather → foundry / developer-tools)

Schema-derived deletion registry (`groupCascade.ts`, `FILE_HOLDERS`), ADR-0029's OTA rule,
the `deleteSelfEnabled` pre-check write-up, `copy-env.sh` (also copies `.dev.vars`), and the
preview path filter. Candidates for developer-tools standards, not for this change.

## Open questions for the user

- Clerk production "Delete self" setting; Play account personal vs organisation; gather's
  production web domain; whether an App Store Connect record exists.
- Sign in with Apple for launch, or ship email-only first (4.8 does not apply today).
