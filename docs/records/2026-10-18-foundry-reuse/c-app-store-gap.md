---
type: record
kind: research
description: Read when preparing gather for the App Store or Google Play; gap against foundry and store policy as of 2026-10-18.
version: 1.0.0
date: 2026-10-18
---

# C — App Store / Play Store gap: foundry vs gather

Research date: **2026-10-18**. Read-only. Foundry was read at `/Users/ericjansen/Developer/workouts` at
`9ee4d38` (feat(account): revoke Sign in with Apple on account deletion). Gather was read at this worktree,
`1284b3f`. The checklist is the `mobile-release` skill (developer-tools), plus
`standards/mobile-baseline.md` ("Build and release boundaries") and `standards/auth.md`.

Policy claims were checked against primary sources on the research date (listed at the end). Statements
marked **unverified** could not be confirmed from the repo, the Clerk config API, or a primary source.

---

## 1. Foundry's release setup today

### Build and submit config — `apps/mobile/eas.json`

| Item | Value |
| --- | --- |
| CLI / version source | `cli.version >= 16.0.1`, `appVersionSource: "remote"`: EAS owns build numbers |
| `development` | dev client, internal, `autoIncrement`, channel+environment `development`, Android APK |
| `preview` | `autoIncrement`, channel+environment `preview`. Store-signed, so it feeds TestFlight |
| `preview-internal` | extends preview, internal distribution, Android APK |
| `production` | `autoIncrement`, channel+environment `production` |
| `submit.preview.ios` / `submit.production.ios` | `ascAppId: "6811609419"`. The App Store Connect record exists |
| Android submit | **none**: no `serviceAccountKeyPath` or `track`. Foundry has not done a Play submission |

### App config — `apps/mobile/app.json` (static JSON; no `app.config.*`)

- **Identity:** name `Foundry`, slug `foundry`, `owner: appelent`, EAS projectId `9cd74697-…`,
  `ios.bundleIdentifier` = `android.package` = `com.appelent.foundry`, scheme `foundry`.
- **Versioning:** `version: "1.0.0"` (set by `7b202e2 chore(release): prepare first store release`).
  Build numbers are remote and auto-incremented.
- **Runtime:** `runtimeVersion.policy: "fingerprint"`, `updates.url` on u.expo.dev. `pnpm-workspace.yaml`
  pins `virtualStoreDirMaxLength: 60` (`docs/runbooks/mobile-releases.md`).
- **iOS:** `ITSAppUsesNonExemptEncryption: false`, `CFBundleAllowMixedLocalizations: true`,
  **`usesAppleSignIn: true`**, `supportsTablet: true`.
- **Permissions (tightened):**
  - `android.permissions: ["android.permission.CAMERA"]`, with `blockedPermissions` for RECORD_AUDIO,
    READ/WRITE_EXTERNAL_STORAGE and every READ_MEDIA_*.
  - `expo-camera` and `expo-image-picker` set `microphonePermission: false` and `recordAudioAndroid: false`.
  - `expo-secure-store` sets `faceIDPermission: false`, which suppresses the generic Face ID string.
  - Purpose strings are app-specific. They are localized through `locales: { en, nl }`
    (`apps/mobile/locales/en.json`: `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`).
- **Privacy manifest:** there is no `ios.privacyManifests` key. Prebuild generates `PrivacyInfo.xcprivacy`, and
  the ignored, stale `ios/Foundry/PrivacyInfo.xcprivacy` declares UserDefaults, FileTimestamp,
  SystemBootTime and `NSPrivacyTracking false`.
  The generated `ios/` is gitignored and **stale**: its Info.plist still has old form-check/microphone
  strings. Treat `app.json` as the truth.
- **Entitlements (generated):** `com.apple.developer.applesignin`, `aps-environment`
  (`expo-notifications`). There are no associated domains or app groups.
- **Observability:** the `@sentry/react-native/expo` plugin is configured. `scripts/publish-update.mjs`
  refuses to publish an OTA update without `SENTRY_AUTH_TOKEN`, then uploads source maps.

### Store metadata, privacy policy, review access

- **Store metadata:** none in the repo. There is no `store.config.json` and no fastlane metadata.
  Screenshots, description, age rating and App Privacy answers are entered by hand in App Store Connect.
- **Privacy statement:** public web route `src/routes/privacy.tsx`, which renders without sign-in,
  with copy in `src/lib/i18n/messages/{en,nl}/privacy.ts`. It is dated 18 October 2026 and covers:
  - the controller (Appelent) and contact `privacy@appelent.nl`
  - the data categories, including health data under explicit consent and AI help with consent
  - processors: Clerk, Convex (EU, Ireland), Cloudflare, Sentry, Expo, Anthropic, Apple/Microsoft
    sign-in, and Open Food Facts
  - transfers (DPF/SCC), retention ("right away" in-app, 30 days by email, diagnostics ≤90 days)
  - rights: in-app export and deletion, plus email
  - a complaint route to the Autoriteit Persoonsgegevens, no use by under-16s, and change notes
- **In-app privacy link:** `PRIVACY_STATEMENT_URL = "https://foundry.appelent.nl/privacy"` in
  `apps/mobile/src/features/profile/account-screen.tsx`.
- **Test account for App Review:** **not documented anywhere** (`docs/runbooks/*` has no review account
  or demo mode). That is still a gap for foundry too.

### Account deletion, export, Sign in with Apple

- **In-app (mobile):** `apps/mobile/src/features/profile/account-screen.tsx` offers two actions:
  - **Delete data**: deletes personal data and keeps the account.
  - **Delete account**: gated on `user.deleteSelfEnabled`, `online`, and the `account.deletionBlocker`
    query. After confirmation it calls `revokeAppleSignIn` and then `useAccountDeletion()`
    (`features/local-data/account-data-maintenance-provider.tsx`), which drains `account.deleteData`
    batches and then `user.delete()`.
- **Backend:** `convex/account.ts` has `deletionBlocker`, `deleteData` (bounded batches, guarded by
  `expectedSubject`) and `revokeAppleSignIn`. The revoke action uses `convex/lib/appleSignIn.ts`, which
  signs a client secret with `APPLE_TEAM_ID` / `APPLE_SIGN_IN_KEY_ID` / `APPLE_SIGN_IN_PRIVATE_KEY`
  routed through `env.manifest.ts`, then calls Apple `/auth/token` and `/auth/revoke`. The client side is
  `apps/mobile/src/features/profile/apple-revocation.ts`: it is iOS-only, it only revokes if
  `credential.user` matches the linked `providerUserId`, a dismissed sheet cancels the deletion, and
  other failures are reported and the deletion proceeds.
- **Web:** `src/routes/account/index.tsx` has an **export only** (`ExportDataCard`), with no delete. For
  deletion outside the app, the privacy statement offers email to `privacy@appelent.nl`, completed within
  30 days. That is foundry's Google Play "web link resource".
- **Export:** `convex/exportData.ts` (`personalPage`, paginated). On mobile,
  `features/profile/account-export.ts` writes a JSON file and opens the share sheet through
  `expo-sharing`.
- **Sign in with Apple (guideline 4.8):** foundry offers Google and Microsoft, so it must also offer an
  equivalent privacy-preserving login, and Apple meets that. Apple uses the native sheet on iOS
  (`expo-apple-authentication`, `usesAppleSignIn`). The shared Clerk application **AppElent** (production
  instance `clerk.appelent.nl`) has Apple (`nl.appelent.web` Services ID) and Microsoft enabled; Google is
  disabled in production. I confirmed this through the Clerk config API on 2026-10-18. The setup is in
  `docs/runbooks/social-sign-in.md`, which also documents "Adding another Appelent app".

### CI / release automation

- `.github/workflows/ci.yml` typechecks and tests `@foundry/mobile`. **No EAS workflow** exists (there is
  no `.eas/workflows/`). Builds and OTA updates are run by hand from macOS, following
  `docs/runbooks/mobile-releases.md`:
  `EXPO_NO_DOTENV=1 pnpm exec eas build --platform ios --profile preview --clear-cache --auto-submit`.
- The runbook's preflight is `expo-doctor` plus
  `eas env:exec preview 'expo export --platform ios …'`. iOS acceptance follows
  `docs/runbooks/ios-acceptance.md`.
- The EAS profile maps to a Clerk instance: `development` uses Clerk dev; `preview` and `production` use
  Clerk production (`social-sign-in.md`). **`preview` uses the live Convex deployment `fine-akita-444`**
  (`mobile-releases.md`, verified there 2026-09-29).

---

## 2. Gather's release setup today

- **`apps/mobile/eas.json`** has the same four profiles as foundry, plus `SHARP_IGNORE_GLOBAL_LIBVIPS=1`.
  `submit.preview.ios` and `submit.production.ios` are **empty `{}`**: no `ascAppId`. There is no Android
  submit config.
- **`apps/mobile/app.json`** (static JSON):
  - name `Gather`, `com.appelent.gather` on both platforms, scheme `gather`, version `1.0.0`, EAS
    projectId `3d074dbc-…`, owner `appelent`
  - `runtimeVersion.policy: fingerprint`, `updates.checkAutomatically: ON_LOAD`,
    `fallbackToCacheTimeout: 0` (ADR-0029)
  - `ITSAppUsesNonExemptEncryption: false`
  - **no `usesAppleSignIn`, no `locales`, no `android.permissions` or `blockedPermissions`, no
    `ios.privacyManifests`**
- **Resolved config.** `expo config --type introspect` was run read-only on 2026-10-18. It shows the
  defaults that foundry suppresses:
  - **Android permissions:** `RECORD_AUDIO` (from `expo-image-picker` because `microphonePermission` is
    unset), `READ/WRITE_EXTERNAL_STORAGE`, `SYSTEM_ALERT_WINDOW`, `VIBRATE`, `INTERNET`. At build time,
    library manifests also merge in `CAMERA` (expo-image-picker) and storage with `maxSdkVersion=32`.
  - **iOS purpose strings:** `NSMicrophoneUsageDescription` uses the generic default
    `"Allow $(PRODUCT_NAME) to access your microphone"`. `NSFaceIDUsageDescription` uses the generic
    default from `expo-secure-store`. Camera and Photos are app-specific (baby-log memory), but only in
    English.
  - **Entitlements:** `com.apple.developer.applesignin` is added by default by the `@clerk/expo` plugin
    (`appleSignIn = true`) even though gather has no Apple button. `com.apple.security.application-groups:
    [group.com.appelent.gather]` comes from `expo-share-intent`.
  - **App extension:** `extra.eas.build.experimental.ios.appExtensions` gains
    `ShareExtension` / `com.appelent.gather.share-extension`, injected by the plugin. EAS has to provision
    **two** bundle IDs plus an App Group. `expo-share-intent` writes its own extension
    `PrivacyInfo.xcprivacy`.
- **Account deletion (in-app):** `app/(app)/(tabs)/settings/account/delete.tsx`. It names the Groups
  that go and the Groups that stay, confirms, then runs `api.accounts.deleteAccount`, `user.delete()`
  and sign-out. It is gated on `deleteSelfEnabled !== false`. The backend is `convex/accounts.ts`,
  `convex/cascade.ts` and `convex/lib/groupCascade.ts`, documented in ADR-0032. Clerk is deleted
  synchronously. The Convex cascade runs in scheduled steps.
- **Account deletion (web):** **none.** `src/routes/_app/account.tsx` renders only `@appelent/auth`'s
  `ProfilePanel`, which has no delete. There is no public page that tells someone how to request
  deletion.
- **Privacy policy:** **none.** There is no `/privacy` route. The only public page is `about.tsx`. Mobile
  has no privacy link, and "Terms and privacy" is still on `docs/mobile-settings-backlog.md`.
- **Export:** none (backlog item "Export your data"). Not a store requirement.
- **Social login:** `src/components/SocialSoon.tsx` renders **disabled "Apple / Microsoft / Google —
  Soon" rows** on the sign-in and sign-up screens, citing #139. Sign-in is email+password/code only, so
  **guideline 4.8 does not currently apply**. It falls under the "exclusively uses your company's own
  account setup" exemption; Clerk-as-processor of your own accounts counts as your own system.
- **Labs** (`src/labs/`) is hidden in production: `sections.ts` gates it on `__DEV__`.
- **Observability on mobile:** none. There is no `@sentry/react-native`, so production crashes are
  invisible.
- **CI:** `.github/workflows/ci.yml` and `preview.yml` skip `apps/mobile/`. There is no EAS workflow.
  Releases use the scripts `deploy:preview` (iOS `--auto-submit`), `deploy:prod` (iOS, no submit),
  `build:preview:android` (APK), and `update:preview` / `update:prod` (with `--environment`).
- **Clerk:** gather uses the same shared AppElent Clerk application as foundry. The production instance
  is `pk_live_…clerk.appelent.nl`. Sign-up is public with email code verification, the password is
  required, and Apple and Microsoft are enabled at the instance level. **"Delete self" is not exposed by
  the Clerk config API** that I could read, so it is **unverified**. Foundry gates on the same flag, so
  check it once in the Dashboard.
- **Toolchain:** RN 0.86 defaults to `targetSdk = 36` / `compileSdk = 36`
  (`react-native/gradle/libs.versions.toml`), so it meets Play's 2026-08-31 rule. Expo SDK 57 is one SDK
  behind foundry's 58.

---

## 3. Gap table

Effort: S ≈ ≤½ day, M ≈ 1–2 days, L ≈ more. "Blocker" means the submission is rejected or cannot be
uploaded without it.

| # | Requirement (source) | Foundry | Gather | Action for gather | Effort | Blocker? |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **Apple 5.1.1(v)**: in-app account deletion, deleting the account record and personal data, not just deactivating it | ✅ Account screen, `account.ts` | ✅ `settings/account/delete.tsx`, ADR-0032 | None in code. Confirm Clerk "Delete self" is on in **production**, otherwise the button is withheld and review fails | S (user) | **yes** if Delete self is off |
| 2 | Apple: an app using SIWA should revoke tokens on deletion (account-deletion FAQ) | ✅ `apple-revocation.ts` + `lib/appleSignIn.ts` | n/a: no SIWA | Only if SIWA is added (row 4): port foundry's revocation verbatim | M | no (yes if SIWA added without it) |
| 3 | **Apple 4.8** login services | ✅ Apple native + Microsoft (+ Google in dev) | n/a today: own accounts only | Ship as is, **or** add Apple/Microsoft with foundry's code and runbook. If any third-party login ships, Apple (or an equivalent) is required | 0 / M | no (yes if Google/MS ship without Apple) |
| 4 | **Apple 2.1(a)**: no placeholder or temporary content | ✅ | ⚠️ Disabled "Apple/Microsoft/Google — Soon" rows on sign-in and sign-up | Remove `SocialSoon` from production builds (gate on `__DEV__` like Labs), or make them real | S | **likely** (rejection risk) |
| 5 | **Apple 2.1(a)**: demo account info for apps with login | ❌ not documented | ❌ | Create a dedicated review account on the **production** Clerk + Convex with a populated household (sample seed is off on prod by design, per `ENABLE_SAMPLE_DATA`), using a mailbox you control. Put the credentials only in App Store Connect / Play Console review notes. Check whether Clerk asks for an email code on a new device | S–M | **yes** |
| 6 | Privacy policy URL (required by App Store Connect; required by Play for all apps; required by GDPR) | ✅ `/privacy` | ❌ | Port `src/routes/privacy.tsx` plus message files. Rewrite the content for gather's data: Groups and members, baby log (data about a child, including vaccinations and growth), household finances, notes and calendar, photos, Notion/Todoist tokens, Anthropic recipe import, Open Food Facts, Sentry (web), Expo. Add an in-app link (Settings → About/Account) | M | **yes** |
| 7 | **Google Play account deletion**: in-app path **and** a web link resource where users can request deletion without the app, referencing the app or developer name | ⚠️ in-app ✅; web = email route in the privacy statement | ⚠️ in-app ✅; web ❌ | Add a public "Delete your Gather account" section or page (email route like foundry's, or a signed-in web delete calling the same `accounts.deleteAccount` + Clerk). Enter the URL in Data safety | S (email) / M (web flow) | **yes** for Play |
| 8 | Play **Data safety** form, and Apple **App Privacy** labels | ❓ entered by hand, not in repo | ❌ | Fill in from the inventory in row 6. Likely categories: Name, Email, User ID, Photos, Health (feeding, sleep, vaccinations on the baby log; nutrition), Other financial info (costs, savings), Other user content. No tracking. Data is encrypted in transit and deletion is available | S (user) | **yes** |
| 9 | **Apple PrivacyInfo.xcprivacy** required-reason APIs (since 2024-05-01) | ✅ generated (UserDefaults, FileTimestamp, BootTime) | ⚠️ generated by prebuild, unverified | No config needed up front. Expo SDK packages ship manifests. After the first TestFlight upload, add any reasons Apple emails about to `ios.privacyManifests` | S | yes only if Apple flags it (it's an upload warning email) |
| 10 | Purpose strings: accurate, app-specific, no unused ones | ✅ mic/Face ID off, localized | ⚠️ generic **microphone** and **Face ID** strings for features gather doesn't use; English only | `expo-image-picker`: `microphonePermission: false`. `expo-secure-store`: `faceIDPermission: false`. Add `locales.{en,nl}` with the camera and photos strings | S | no, but vague or unused strings are a common 5.1.1 rejection |
| 11 | Android permissions / Play **Photo & Video permissions policy** (in force 2025-05-28) | ✅ blocked list | ⚠️ RECORD_AUDIO, legacy storage, SYSTEM_ALERT_WINDOW | Add `blockedPermissions` (RECORD_AUDIO, READ/WRITE_EXTERNAL_STORAGE, READ_MEDIA_*, SYSTEM_ALERT_WINDOW) and check the merged manifest of the preview AAB (`aapt dump permissions`). Gather uses the system picker, so it needs no READ_MEDIA declaration | S | no (an unexplained RECORD_AUDIO draws Play questions) |
| 12 | Play **target API** ≥ 36 for new apps and updates from 2026-08-31 (extension to 2026-11-01) | ✅ (RN 0.88) | ✅ targetSdk 36 (RN 0.86) | Confirm in the built AAB | S | no |
| 13 | Apple **SDK minimum**: Xcode 26 / iOS 26 SDK since 2026-04-28; min deployment iOS 13 since 2026-09-09 | ✅ builds today | ❓ | Make sure the EAS image for SDK 57 uses Xcode 26 (the default image should) | S | yes if the image is older |
| 14 | `ITSAppUsesNonExemptEncryption` | ✅ false | ✅ false | None. HTTPS only is exempt | – | no |
| 15 | ATT / tracking | n/a | n/a | None: no ad SDKs or tracking. Answer "No tracking" in the labels | – | no |
| 16 | iOS signing for **share extension + App Group** | n/a | ⚠️ new: two bundle IDs + `group.com.appelent.gather` | Let EAS credentials create both profiles. Register the App Group under the Team, or let EAS capability sync do it. Run the first `eas build -p ios` interactively | S–M | **yes** (build fails otherwise) |
| 17 | App ID capability **Sign in with Apple** (entitlement injected by `@clerk/expo`) | ✅ grouped under the primary App ID | ⚠️ entitlement present, feature unused | Either enable SIWA on `com.appelent.gather` (EAS capability sync does this) grouped under `com.appelent.foundry`, or set the `@clerk/expo` plugin to `appleSignIn: false` until SIWA ships | S | yes (profile/entitlement mismatch) |
| 18 | App Store Connect app record and `ascAppId` | ✅ `6811609419` | ❌ | Create the app record, then put `ascAppId` in both submit profiles | S (user) | **yes** |
| 19 | Play app, service account key, `submit.*.android` | ❌ (foundry not on Play yet) | ❌ | Create the Play app and a service account in EAS. Add `submit.preview.android: { track: "internal" }`. The default `eas submit` targets internal and needs no manual first upload (Expo docs, 2026-10-18) | S–M (user) | **yes** for Play |
| 20 | Play **personal account testing rule**: 12 testers × 14 consecutive days in closed testing before production (personal accounts created after 2023-11-13) | n/a | ❓ account type unknown | Check whether the Play developer account is personal or organisation. If personal, start the closed test early | – (calendar) | yes for **production** only; internal testing is unaffected |
| 21 | **EU DSA trader status** (App Store, EU) | ❓ | ❓ | One-time declaration in App Store Connect per account. Gather is NL-first, so EU distribution matters | S (user) | **yes** in the EU |
| 22 | **Age rating** questionnaire (new system, answers needed since 2026-01-31) and Play IARC | ❓ | ❌ | Answer both. User-generated content is shared only within a Group, there is no public UGC and no chat | S (user) | **yes** |
| 23 | Store listing: screenshots, description (en/nl), support URL, category | ❓ by hand | ❌ | Write the copy. Screenshots can come from `agent-device` and the simulator | M (user + agent) | **yes** |
| 24 | Crash reporting on mobile | ✅ Sentry RN + source-map OTA guard | ❌ | Recommended before external testers: port `docs/runbooks/sentry.md` + `scripts/publish-update.mjs`. Native dependency, so it needs a build | M | no |
| 25 | Data export (GDPR access/portability) | ✅ mobile and web | ❌ | Not a store rule. The email route in the privacy policy is enough for launch | M | no |
| 26 | Backend for review: reviewer hits production Convex + Clerk | ✅ (preview → live Convex) | ❓ | Make sure the `preview` EAS environment points at a deployment that stays up and holds the review account (Apple 2.1: "turn on your back-end service") | S | **yes** |

---

## 4. Who has to do what

**The user personally** (accounts, dashboards, legal and identity declarations):

1. **Clerk Dashboard**, production instance: confirm **User & authentication → Delete self** is on
   (row 1). If SIWA ships: add `com.appelent.gather` under **Native applications** and allowlist
   `gather://sso-callback`.
2. **Apple Developer**:
   - Check that App IDs `com.appelent.gather` and `com.appelent.gather.share-extension` and App Group
     `group.com.appelent.gather` exist, or approve EAS creating them during the interactive first build.
   - Decide on SIWA. If yes, group the App ID under primary `com.appelent.foundry`.
3. **App Store Connect**:
   - create the app record and hand over the `ascAppId`
   - App Privacy answers, age rating, EU trader status (if not already done for the account)
   - review notes with the demo account, screenshots, support/privacy URLs, TestFlight testers
4. **Google Play Console**:
   - create the app
   - create the service account, then upload its key to EAS (`eas credentials -p android`)
   - Data safety form including the deletion URL, content rating, target audience (not children)
   - store listing, and internal/closed testers
   - confirm whether the account is personal or organisation (row 20)
5. **Domain and legal:** confirm gather's production web domain (it must sit under `appelent.nl` for
   Clerk production, but no route is in `wrangler.jsonc`). Approve the privacy statement wording, since
   the controller is named and it involves child data. Decide the support email.
6. **Review account:** own the mailbox, and run the first sign-in if Clerk asks for an email code.
7. **Build credentials:** run or approve the first interactive `eas build` and `eas submit`. Per the
   skill, the agent must not rotate credentials or buy or submit builds without authorisation.

**What an agent can implement:**

- rows 4, 10, 11, 17-option-B: `app.json` and `SocialSoon` gating
- the privacy route and copy in en/nl, plus the deletion-request section or web delete flow (rows 6, 7)
- in-app Privacy/About links
- `eas.json` submit profiles once the IDs exist
- review-account population: an internal mutation, or a documented manual script
- the Sentry port
- runbooks
- a Data safety / App Privacy answer draft for the user to paste
- screenshots via `agent-device`
- the post-build checks: merged-manifest permission audit and PrivacyInfo warnings

---

## 5. Recommended order to TestFlight / Play internal testing

1. **Config hygiene** (agent, one native change, so batch it before the first store build):
   - `microphonePermission: false` (image-picker), `faceIDPermission: false` (secure-store)
   - `blockedPermissions` list, `locales.{en,nl}` purpose strings
   - SIWA decision: `usesAppleSignIn: true`, or `@clerk/expo` `appleSignIn: false`
   - optionally add `@sentry/react-native` now, so it rides the same fingerprint
2. **Remove placeholders** (agent): gate `SocialSoon` on `__DEV__`.
3. **Privacy and deletion pages** (agent → user approves copy): `/privacy` with a deletion-request
   section, then an in-app link. Deploy the web.
4. **Clerk check** (user): Delete self on in production.
5. **Apple records** (user): App Store Connect app, then the agent sets `ascAppId`. First
   `pnpm --filter @gather/mobile deploy:preview` runs **interactively** (with `EXPO_NO_DOTENV=1`, per
   foundry's runbook) so EAS can provision the main app, the share extension and the App Group.
   → **TestFlight internal testing** works without App Review; only external TestFlight needs Beta App
   Review.
6. **Play** (user creates the app and service account; agent adds `submit.preview.android.track: internal`):
   `eas build -p android --profile preview` then `eas submit -p android --profile preview` puts it on
   **internal testing**. Start the closed test now if the account is personal.
7. **Review account and backend** (agent + user): populate the production review household. Confirm the
   `preview` EAS environment points at production Convex and Clerk.
8. **Store forms** (user, agent drafts): App Privacy, Data safety, age ratings, trader status, listing,
   screenshots.
9. Device acceptance on a real iPhone and Android, then submit for review.

Steps 1–4 can proceed in parallel with the user's account work in steps 5–6.

### Reusable from foundry

- **Verbatim, with names swapped:**
  - `docs/runbooks/mobile-releases.md`: the build/submit/OTA flow, `EXPO_NO_DOTENV=1`, preflight
    (`expo-doctor` + `eas env:exec preview 'expo export …'`), and the `virtualStoreDirMaxLength` note
    (gather already has it). Merge it with gather's `apps/mobile/README.md` "Shipping a change" rather
    than duplicating it.
  - `docs/runbooks/social-sign-in.md` §"Adding another Appelent app" and §"Apple token revocation", if
    SIWA ships.
  - `apps/mobile/src/features/profile/apple-revocation.ts`, `convex/lib/appleSignIn.ts`, the
    `account.revokeAppleSignIn` action, the `env.manifest.ts` entries for `APPLE_TEAM_ID` /
    `APPLE_SIGN_IN_KEY_ID` / `APPLE_SIGN_IN_PRIVATE_KEY` (Infisical keys are shared), and
    `convex/appleSignIn.test.ts`.
  - `apps/mobile/scripts/publish-update.mjs` (Sentry-guarded OTA). Gather's `update:*` scripts would
    wrap it while keeping `--environment`.
  - `docs/runbooks/ios-acceptance.md` **structure** (the rows are foundry-specific).
- **As a template:**
  - `src/routes/privacy.tsx` and `src/lib/i18n/messages/{en,nl}/privacy.ts`: the structure, provider
    list wording, rights, AP complaint route and retention phrasing. Gather's data inventory differs.
  - The `app.json` permission block (`blockedPermissions`, `microphonePermission: false`,
    `faceIDPermission: false`, `locales`).
- **Not reusable:**
  - foundry's `account.deleteData` / `personalData` model. Gather's Group cascade (ADR-0032) is
    already the right shape.
  - foundry's export, unless gather decides to add one.

---

## Open / unverified

- Clerk production "Delete self" state: not readable through the config API.
- Whether gather's Play developer account is personal or organisation.
- Gather's production web domain.
- Whether an App Store Connect record for `com.appelent.gather` already exists.
- Whether App Group and share-extension provisioning succeeds unattended on EAS: the first build must
  be run interactively and observed.
- PrivacyInfo completeness is only proven by Apple's post-upload email.
- Whether Clerk production challenges a new-device sign-in with an email code (it affects the reviewer
  login).

## Sources (fetched 2026-10-18)

- Apple App Review Guidelines, §2.1(a), §4.8, §5.1.1(v): https://developer.apple.com/app-store/review/guidelines/
- Apple, Offering account deletion in your app: https://developer.apple.com/support/offering-account-deletion-in-your-app/
- Apple, Upcoming requirements (Xcode 26 SDK 2026-04-28; iOS 13 min 2026-09-09; age rating 2026-01-31; privacy manifests 2024-05-01; DSA trader status): https://developer.apple.com/news/upcoming-requirements/
- Google Play, Account deletion requirements: https://support.google.com/googleplay/android-developer/answer/13327111
- Google Play, Target API level (API 36 from 2026-08-31, extension to 2026-11-01): https://support.google.com/googleplay/android-developer/answer/11926878
- Google Play, Photo and video permissions (full compliance 2025-05-28): https://support.google.com/googleplay/android-developer/answer/14115180
- Google Play, Testing requirements for new personal accounts (12 testers / 14 days): https://support.google.com/googleplay/android-developer/answer/14151465
- Expo, Privacy manifests: https://docs.expo.dev/guides/apple-privacy/
- Expo, Submit to Google Play: https://docs.expo.dev/submit/android/
- Clerk config API, AppElent production instance (read-only `get_instance_config`)
- Local: `expo config --type introspect` for gather; `node_modules` sources of `expo-image-picker`
  57.0.19, `expo-share-intent` 8.0.1, `@clerk/expo` 4.2.3 and RN 0.86 `libs.versions.toml`
