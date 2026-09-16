# Tasks prototype findings — review pending

## Question and authority

How should a Member move between today's work, their responsibilities and reusable
Task lists while using one explicit-Save create/edit form?

The accepted decisions in
[the shared plan](../plans/2026-09-16-notes-tasks-calendar-redesign.md), ADR-0021
and ADR-0034 constrain this exploration. No production implementation is authorized.
The Tasks brief, shared plan, ADR-0034 and modified CONTEXT.md were copied from
the uncommitted working tree at `D:/Dev/gather` into this prototype branch and
verified byte-for-byte on 16 September. Originals were left untouched.

## Runnable primary source

- Branch: `prototype/tasks-redesign`, existing checkout
  `C:/Users/ericj/orca/workspaces/gather/prototype-tasks-redesign`.
- Artifact: `apps/mobile/prototypes/tasks-redesign/`.
- Run: `pnpm prototype:tasks` from the branch root.
- URL: http://localhost:4311/prototype/tasks?variant=A (also B and C).
- Archive: local commit on `prototype/tasks-redesign` titled
  `prototype(tasks): archive native A exploration and findings`; not pushed.
- Historical prototypes and backend files are unchanged; the mobile app has a dev-only entry and prototype dictionaries.
- Dedicated browser route rationale: preserve mobile shell context while keeping
  all experimental behavior out of authenticated production routes. This is a
  browser study of mobile layout, not a functional-web implementation.

## User-selected elements and reasons

- User likes Todoist and supplied its Today/quick-composer screenshot as a reference.
- Specific element selections and reasons: **pending review**. The first pass
  interprets that preference as compact rows, completion circles, child progress,
  dates, assignee avatars, list provenance and a compact property-chip composer.
- The same screenshot was supplied again after the user said the wrong thing had
  been uploaded. It does not establish additional attachment/voice scope.
- User prefers **A — Today first for functionality**. Continue exploring from A;
  this does not accept every behavior or visual detail within it.
- Visual design is **not approved**: user reports that some parts do not feel
  like iOS. The user identified missing native interactions, then iOS list padding. Address layout and interaction-design
  feedback in this session; do not defer all native-feel concerns to implementation.
  Native keyboard, sheet, picker and gesture fidelity still needs device review.
- Row density, detailed list navigation and editor arrangement remain open.
  Combining elements across alternatives is explicitly allowed.
- B and C are not the preferred overall functional direction; individual elements
  have not been rejected and remain available for comparison.

## Latest review: iOS spacing and Close semantics

The user supplied IMG_1889.PNG showing edge-to-edge row content and asked for
consistent iOS padding. Hosted header, row and footer content now own 16-point
horizontal padding; the list footer reserves clearance for the floating tab bar.
The iPhone result still needs visual confirmation.

**Supersedes the earlier accepted draft-on-dismiss behavior:** Close on a changed
form asks Keep editing / Discard changes (EN/NL). Discard deletes the draft and
closes; Keep editing leaves the form intact. An unchanged form closes immediately.
Backdrop and Android back use the same close handler. Save still explicitly
applies edits. Existing suspended drafts from the earlier iteration can be opened
and discarded. Recovery after interruption/restart remains a separate open issue.
The browser alternatives retain their historical behavior; native A is current.

Verified on Android: unchanged Close dismisses immediately; changed Close shows
the prompt; Keep editing retains text; Discard closes and the next Add starts
empty. Scoped Biome, mobile TypeScript and iOS bundle compilation pass.

## Alternatives presented

### Native continuation requested by the user

After preferring A functionally, the user identified missing native evidence:
top-right iOS menu controls, long-press menus, swipe actions and recognizable
bottom sheets. They requested moving the exploration into the mobile app and
confirmed an existing iPhone development build: start Metro, do not rebuild.

The current review surface is `apps/mobile/src/modules/tasks/prototype/`, reached
via the development-only Tasks header entry or `gather://all/tasks-prototype`.
Run `pnpm --filter @gather/mobile start:dev-client --port 8082 --lan`.
At setup, the LAN address is `http://192.168.68.50:8082`; 8081 belongs to Workouts.

The user requested a global Tasks/Taken title, reliable date selection, a
keyboard-anchored composer that expands upward, an obvious Save button, fewer
unnecessary Resume prompts, and full-swipe execution. These are accepted review
requirements; final visual design remains unapproved.

A now uses an iOS SwiftUI List with Expo UI SwipeActions and ContextMenu.
Full right swipe completes; full left opens Edit. Short swipes expose buttons;
Delete still requires confirmation. Full-swipe execution was requested; the exact
left/right action mapping is a proposal awaiting review.
Reference: https://docs.expo.dev/versions/latest/sdk/ui/swift-ui/swipeactions/
Android uses ReanimatedSwipeable with simultaneous full-swipe detection.

Create and edit share a compact keyboard-anchored React Native Modal composer.
More details expands upward while preserving the host; Save remains in its fixed
header. The date picker updates the draft within the same editor. Unlike the old
NativeSheet composer, expansion does not switch RNHostView matchContents (which
forces a native host remount). This is a plausible cause of the reported iOS
picker dismissal, not a device-confirmed diagnosis. Unchanged forms close without
retaining a draft; changed drafts remain resumable. List chooser and diagnostics
still use native bottom sheets. The composer currently uses Close/backdrop,
not a drag-to-dismiss gesture. List navigation retains native Back.

Android interaction verification (Pixel_9_Pro_2, Gather inside installed Expo Go):
- Changed plumber due date Sep 14 to Sep 17 using the calendar; Save confirmed and
  removed it from Today. The original picker dismissal was not reproduced here.
- Opened/closed an unchanged task: no Resume draft entry remained.
- Added text, expanded, closed and resumed: text retained; Save confirmed.
- Inspected compact composer above Gboard and expanded composer; fixed status-bar
  overlap by adding safe-area padding. Save and Close remain visible.
- Full right swipe on bins executed completion without a second tap; next due
  Sep 22 asserted. Full left swipe opened the bathroom editor with Save available.

Mobile TypeScript, scoped Biome and iOS Metro bundle compilation pass. No app
rebuild was performed. Actual iOS picker/composer behavior, SwiftUI row sizing,
context menus/full-swipe feel, VoiceOver and Dynamic Type still require review on
the user's development build. Android evidence does not validate those iOS paths.
All records and writes remain in memory. The original browser A/B/C study is
preserved. Draft lifetime after reload and conflict UX remain open.

No native packages, app configuration, production writes or deployment were
changed. The only existing Tasks-screen change is a development-only prototype
entry, plus EN/NL prototype dictionary registration. Do not treat this as the
production Tasks redesign.

### Original browser alternatives

| Variant | Landing hierarchy | Navigation tradeoff to judge |
| --- | --- | --- |
| A — Today first | Overdue and Today rows; Everyone/Mine filter; lists below | Immediate action, but Mine here only narrows today's work |
| B — Lists first | Today/Mine smart destinations above reusable lists | Familiar collections; all-date Mine includes undated responsibilities |
| C — Responsibility first | Eric, Anne and Unassigned sections, then lists | Ownership is explicit, but ordinary grocery items lengthen Unassigned |

All use the same fixtures and composer. List/date/priority chips stay visible;
assignment, recurrence, explicit reminder, notes, labels and one-level children
sit under More details. Existing tasks open that section expanded. Dismissal keeps
an in-memory draft; Save applies the draft together; row completion applies directly.
Diagnostics are outside product UI.

## Scenarios exercised and evidence

Playwright browser interaction checks on 16 September 2026:

- Created a grocery draft, dismissed it, verified no shared task existed, resumed
  the same text, saved and verified the new task belonged to Groceries.
- Completed overdue fixed Tuesday task: 15 September → 22 September.
- Completed overdue completion-based bathroom task: → 23 September from completion
  on 16 September; confirmed unfinished children, observed reset children and a
  history snapshot containing their completed states.
- Completed monthly 31st task on 31 January: next due 28 February 2026.
- Notion completion disabled. Todoist outage disabled completion. Restored the
  provider and verified completion after the simulated acknowledgement.
- Chose a date and reminder, observed selected-recipient status; disabled personal
  task reminders, resumed draft, observed the disabled reminder status.
- Visited all three variants. Captured EN/light desktop layout, NL/dark/large-text
  responsibility view at 390px width without horizontal page overflow, and editor.
- Evidence screenshots: `output/playwright/tasks-A.png`, `tasks-B.png`,
  `tasks-C.png`, `tasks-C-nl-dark-large.png`, `tasks-composer.png`.

These checks cover the browser study only. See the native continuation above for
subsequent Android checks. iOS gestures, safe areas, keyboard behavior, Dynamic
Type, haptics and accessibility traversal are not verified by these browser checks. Browser large text is not native Dynamic Type. No tests were
added and no production-readiness claim is made. The brief's referenced
`docs/mobile-interaction.md` and `apps/mobile/src/labs/entries.ts` are absent in
this checkout; the research vocabulary and current native wrapper were inspected.
The research file is explicitly not a binding replacement for the missing rules.

## Open decisions and proposed changes

- Today/Mine: whether unassigned belongs in Mine; whether a Today ownership filter
  should have the same label as an all-date personal destination. Inspector toggle
  is exploratory, not an accepted preference setting.
- Child behavior: dates when the parent repeats, history retention, independently
  finding/completing assigned children, and undo of recurring completion remain open.
  Unchanged child dates and history snapshots are visible placeholders only.
- Early recurring completion is blocked pending design, not chosen as final behavior.
- Draft lifetime after restart/access loss and conflict with direct completion while
  a draft is suspended need final-spec rules. Current draft recovery is session-only.
- Todoist assignment/recurrence/subtask mapping and remote-success/cache-failure
  reconciliation remain unresolved; unsupported fixture fields are disabled.
- Notification consent, queues, rescheduling, deduplication and OS permission
  timing remain unresolved. Inspector preferences belong to Eric; assigning Anne
  must use Anne's preferences, not Eric's. No delivery is performed.
- Bulk rescheduling from the reference screenshot is an **unaccepted proposal**:
  confirm moving writable, non-repeating overdue tasks in the current view to
  tomorrow. Recurrence rescheduling would need a separate policy.
- Attachments and voice remain outside scope. The clarification did not authorize
  expanding them. Close semantics were separately superseded as recorded above.
- Preserve production Drop capture, per-list display preferences, existing checklist
  consumers and basic web functionality in the final spec. Their implementation
  is not covered by this bounded prototype; the row toggles here are global lab controls.

Return this ledger to the coordinating conversation as the closed-session result. Do not
promote prototype code or mark issue 211 implementation-ready.


## Handoff verdict

- Carry A (Today-first) forward as the functional direction; do not call the visual
  design approved. User ended the session after the final spacing/Close revision,
  without confirming the last iPhone rendering.
- Preserve a global Tasks/Taken title, native menus and full-swipe capability,
  compact keyboard-anchored create/edit composer expanding upward, and prominent
  fixed Save. Exact styling and swipe action mapping remain reviewable.
- Close must not silently suspend a draft. Current chosen interpretation asks
  before discarding changed input; unchanged input closes directly. This is the
  one explicit override to the incoming accepted-decision set.
- Preserve all other incoming domain decisions. Resolve the open items above in
  the final spec, especially Mine/unassigned, recurring child dates and undo,
  provider capabilities and notification scheduling.
- Keep attachments/voice out of scope. Do not infer feature acceptance from every
  button visible in a reference screenshot.
- Reference this prototype as evidence; rewrite production implementation under
  normal project standards. No backend, provider or notification writes occurred.

## Lessons learned

1. Browser alternatives answer navigation and information-hierarchy questions,
   but not native interaction questions. Once the user asks about sheets, keyboard,
   long press or swipe feel, review in the existing development build early.
2. Functional preference is not visual approval. Track these separately, and treat
   ending the session as closure rather than acceptance of unverified revisions.
3. Save and cancellation must be obvious before evaluating richer fields. Silent
   draft retention created friction; explicit discard confirmation better matches
   this user's expectation. Do not retain unchanged editor snapshots as drafts.
4. Inspect native-wrapper lifecycle when presentation unexpectedly disappears.
   Switching RNHostView matchContents remounts its host; keeping the composer host
   stable avoids that transition, but the reported iOS cause remains unconfirmed.
5. Use the platform's interaction primitive when native feel is the question.
   Expo SwiftUI SwipeActions requires a SwiftUI List; a gesture-handler approximation
   cannot establish iOS swipe feel. Full swipe and revealed-button taps are separate
   behaviors to verify.
6. Layout at the SwiftUI/React Native boundary needs explicit ownership. Section
   insets did not produce the intended hosted-row padding in the user's screenshot.
   Check real screen edges, safe areas, floating tabs and the visible OS keyboard.
7. Device action assertions and screenshots complement each other. Android caught
   expanded-composer status-bar overlap; Android success did not predict iOS padding.
   Test with the real keyboard, since the automation IME hides layout problems.
8. Keep a supersession ledger. The original brief's draft-on-close rule changed
   during review; the final spec must use the latest user decision, not copy the
   earlier accepted list unchanged. Main's untracked planning docs were relevant
   inputs and were copied without altering the originals.
