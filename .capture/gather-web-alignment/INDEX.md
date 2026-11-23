# Gather web vs iOS — design comparison screenshots (2026-11-23)

Source: `origin/main` @ 985d171d (throwaway worktree, since removed). Backend: dev Convex `basic-ibex-235` (no functions pushed).
Account: Clerk dev test user. Group: **Willow Street** (Sample household, already loaded — sample data was not reloaded). Empty state uses the empty Group **test**.

- **Web**: Vite on localhost:3417, headless Playwright Chromium, deviceScaleFactor 2. 390x844 (mobile emulation) and 1280x800, light and dark, viewport only, plus `*-1280-light-full.png` full-page per screen.
- **iOS**: dev client (Debug, Metro :8092) on `agent-design-web-alignment-run-…` (iPhone 17 Pro, iOS 27), screenshots via `xcrun simctl io`, appearance via `xcrun simctl ui … appearance`.

Files: `web-<screen>-{390,1280}-{light,dark}.png`, `web-<screen>-1280-light-full.png`, `ios-<screen>-ios-{light,dark}.png`.

| Screen | Web route | iOS screen | Notes |
|---|---|---|---|
| home | `/home` | Home tab (`gather-dev://home`) | Web Start = members + activity feed; iOS = overdue card + Today timeline |
| all-modules | `/all` | All tab (`all`) | |
| tasks-index | `/tasks` | All → Tasks (`all/tasks`) | Web shows every list as a card on one page |
| task-list | `/tasks`, scrolled to the **House** card | Tasks → House (3 open, 1 completed) | Web has no single-list route; the shot scrolls `/tasks` to House |
| groceries | `/groceries` | All → Groceries | **Web: "Module gepland" placeholder** (not built on web) |
| meal-planner | `/meal-planner` | All → Meal planner | **Web: placeholder** |
| recipes | `/recipes` | All → Recipes | |
| recipe-detail | `/recipes/js75seza5kke84ndns9ytaxdsh8jsaem` (Shakshuka) | same recipe | |
| notes | `/notes` | All → Notes | **Web: placeholder** |
| calendar | `/calendar` | All → Calendar | **Web: placeholder** |
| settings | `/settings` | Settings tab | |
| create-task | `/tasks` → "Toevoegen met details…" (inline form, text typed, not submitted) | Quick-add sheet (`quick?action=task-new`), text typed, not submitted | Web has no dialog/sheet for a new task; it's an inline form in the list card |
| empty-state | `/recipes` in Group "test" | Recipes in Group "test" | |
| search | `/home` → "Ga naar" (⌘K palette, empty) | Search tab with query "pasta" | Web palette only navigates to modules; it doesn't search content |

## Caveats / blockers
- **Language differs**: web renders in Dutch (the test account's language), the iOS simulator is English (run-mobile default `--lang en`). Content (sample data) is the same.
- **Web dark mode** is forced in the page (html `class="dark"`), because the account's stored theme (Clerk `unsafeMetadata.theme = light`) overrides localStorage and I didn't change account settings.
- The TanStack Devtools floating button is hidden with CSS in web shots (dev-only chrome).
- Web 390: task-list cards overflow the viewport horizontally on `/tasks` (cards cut on the right) — real app behaviour, not a capture artifact.
- Nothing was blocked: all 14 screens captured on both platforms (70 web + 28 iOS PNGs).
