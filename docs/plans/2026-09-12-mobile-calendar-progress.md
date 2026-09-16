# Mobile calendar implementation progress

Updated 12 September 2026.

| Milestone | Status | Evidence / gap |
| --- | --- | --- |
| 1. Pure model and vocabulary | Complete | `packages/core` typecheck and 9 focused tests pass; commit `654c094`. |
| 2. Continuous scrolling and header handoff | Partial | Production-shaped fixture preview, virtualized agenda, navigation state tests and mobile typecheck pass. Android Expo Go verification reached the connected calendar, confirmed the date grid/agenda, and confirmed the Month/Week handle transition. Full gesture matrix remains. |
| 3. Schema, API and backend tests | Complete | Convex dev target accepted schema/functions; Convex typecheck and 8 focused calendar/kitchen tests pass, including legacy normalization, atomic clearing, authorization, private preferences, revision conflict, and 100+5 pagination. |
| 4. Paginated data and private filters | Complete | Calendar metadata/events use paginated queries, normalized merge/deduplication, calendar visibility, and membership-scoped people preferences. Convex pagination validators accept split-page metadata. |
| 5. Draft lifecycle | Complete | Namespaced SQLite KV drafts, debounce/flush persistence, resume/discard flow, dirty navigation guard, conflict/deleted-save states, and explicit-save-only mutations are implemented and covered by focused draft tests. |
| 6. Card and expanded sheet | Complete | Shared card/sheet editor exposes title, civil date, all-day or same-day time, WHO, calendar, location, notes, duplicate/delete, translated validation and keyboard-safe controls. |
| 7. Routes, detail entry and sample data | Complete | Production All → Calendar route, event detail/editor entry, calendar management/filter sheets, and mixed local-calendar fixture seed data are wired. Labs remains a fixture reference. |
| 8. Regression and device acceptance | Partial | Focused calendar tests, core/mobile/Convex typechecks, targeted Biome/ESLint, and web build pass. Android Expo Go route/editor smoke verification passes after fixing scroll and pagination runtime errors. Full repository tests/lint/check still report unrelated existing failures; iOS and release-build verification were not available. |

No production deploy, OTA update, release build, PR, or sample-data reset was performed.
