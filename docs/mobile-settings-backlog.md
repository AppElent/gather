# What the mobile Settings tab is expected to hold

**Nothing here is decided.** These settings were invented to give the Settings
prototype a realistic size — today's screen has four rows, and four rows tell
you nothing about whether a layout survives — and they are recorded here
because the list turned out to be a better description of where the tab is
going than anything we had written down. Read it as a set of candidates, not a
roadmap. "Quiet hours" is a plausible sentence, not a commitment.

The prototype itself is the primary source and does not merge:
`prototype/mobile-settings-tab`, two commits, four variants. The shape that won
— the platform's grouped list with a search field over it — is in
`apps/mobile/app/(app)/(tabs)/settings/`, and the decision is
[ADR-0018](adr/0018-mobile-tabs-are-app-destinations-and-one-of-them-is-a-verb.md).

## What is built

Two groups, four settings, in `apps/mobile/src/settings/sections.ts`.

| Group | Settings |
| --- | --- |
| **Account** | Account, Groups |
| **On this phone** | Appearance, Language |

The shipped grouping is not the prototype's. The prototype had eleven sections
because it needed eleven; the real screen has the two that are true — what
follows you to another device, and what is written to this phone. **A candidate
below does not arrive with its section**; it arrives and gets filed, and its
group is a claim about where the setting lives that has to survive being read.

## The candidates

Grouped as the prototype had them, which is how they were thought of rather
than where they would land.

### Notifications

Nothing exists for this — no push token, no server-side scheduling — so the
whole group is behind a piece of infrastructure rather than a screen.

| Setting | What it would mean |
| --- | --- |
| Allow notifications | Anything at all, on this phone |
| Tasks due | Something in a shared list is due |
| Mentions | A member names you in a note |
| Group activity | Anything anybody adds |
| Summary | One message instead of each event (daily / weekly / off) |
| Quiet hours | Nothing gets through between these |

### Integrations

**The closest to real.** The Tasks Module already has Notion and Todoist
provider adapters and OAuth credentials in the Convex deployment; the web owns
the callback. What is missing on the phone is a place to see and revoke a
connection — largely a screen over behaviour that exists, rather than new
behaviour.

| Setting | What it would mean |
| --- | --- |
| Notion | Task lists kept in Notion — connected / not connected |
| Todoist | The same, for Todoist |
| Apple Health | Send what you log to Health |
| Calendar | Put the meal plan in your calendar |

### Home and modules

| Setting | What it would mean |
| --- | --- |
| Pinned modules | What this Group keeps on Home |
| Module order | The order they appear in |
| Opens on | The tab Gather starts on |
| Recent activity | What changed since you last looked |

Note the collision worth resolving before any of these are built: Pins are
per-Group and Settings is not. ADR-0015 makes the Group ambient and Home the
one place that names it, so a per-Group setting reached from a Group-less tab
needs an answer about *which* Group it is editing.

### Units and formats

These are not chrome. A measurement unit changes how a Recipe's ingredients and
the Nutrition Module's numbers are *written*, so this group reaches further
into the Modules than anything above it.

| Setting | What it would mean |
| --- | --- |
| Measurements | Grams and litres, or cups and ounces |
| Week starts on | Where the planner's week begins |
| Dates | How a date is written |
| Energy | kcal or kJ |

### Data and storage

| Setting | What it would mean |
| --- | --- |
| Keep for offline | Recipes stay readable without a connection |
| Clear cache | Free up space on this phone |
| Export your data | Everything in your Groups, sent to you |
| Last synced | When this phone last caught up (a fact, not a choice) |

"Keep for offline" contradicts the app's current promise: mobile is
connected-only by design, with an Unavailable state and recovery behaviour
built for it. Offline reading is a decision to reopen that, not a toggle.

### Privacy and security

| Setting | What it would mean |
| --- | --- |
| Lock Gather | Ask for Face ID when it opens |
| Usage data | Anonymous, and it is what finds the bugs |
| Blocked members | People who cannot join your Groups |

### Account, beyond what exists

Account is a hub now, not a card: Name, Password, Email, Devices and Delete
account each have their own screen under `settings/account/`, and the picture
is the avatar at the top. They are indexed as `children` of the Account row in
`sections.ts`, so the field finds them even though the list never draws them.

Deleting an account was never on this list and should have been — it is an App
Store requirement for any app that can create one (5.1.1(v)). See ADR-0032.

What is still open:

| Setting | What it would mean |
| --- | --- |
| Add an email address | A verification round trip; read-only today, and says so |
| Opens in | The Group Gather starts in |
| Invites | Codes you have sent and received |
| Members and roles | Who can change what |

### Help and About

Cheap, and the only group here with no prerequisite at all.

| Setting | What it would mean |
| --- | --- |
| Help centre | How the Modules are meant to work |
| Contact support | A person reads these |
| Report a problem | Sends what the app was doing at the time |
| Version | What is installed on this phone |
| What's new | Everything that landed recently |
| Terms and privacy | The agreement you are under |
| Open source licences | What Gather is built on |

## What a setting has to do to land

Four things, and the second is the one that will be forgotten:

1. **A screen under `app/(app)/(tabs)/settings/`**, pushed from the list. One
   setting, one screen — the index is the list now, and stacking three controls
   onto one surface is what the old Settings screen did before there was a list
   to hold them.
2. **An entry in `src/settings/sections.ts`.** The screen draws that
   declaration, so a setting that skips it is a setting the search field cannot
   find — and nothing about the screen would ever tell you. `sections.test.ts`
   checks the matcher, not your memory.
3. **Its strings in both `messages/en.ts` and `messages/nl.ts`**, English
   first. A missing key is a type error (ADR-0011).
4. **Links that say `/settings/…`, never `/account`.** ADR-0018 budgeted this
   trap and it is still open: a link that escapes the tab's stack takes the tab
   bar with it.

## What retires this document

Every candidate either built or explicitly dropped. Failing that, it should be
deleted the moment it stops describing where the tab is going — a stale list of
settings nobody intends to build is worse than no list, because it reads like a
plan.
