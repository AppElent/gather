# Tasks Module — Provider Adapter Pattern Design

**Date:** 2026-07-17
**Status:** Approved (design); ready for implementation planning
**Scope:** First sub-project of a larger "adapter pattern for calendar/tasks/notes" initiative.
Builds the Tasks module (`/tasks`, currently a placeholder — see `src/routes/_app/tasks.tsx` and
`src/lib/modules.ts`) on top of a provider-adapter architecture supporting local storage plus
two read-only external providers: Notion and Todoist. Calendar and Notes are explicitly **out of
scope** — they get their own specs once this adapter interface is proven against real usage, and
may reuse the pattern established here without being identical to it (different data shapes,
different provider sets).

---

## 1. Context

Tasks today is a pure `ModulePlaceholder` with no schema, no routes beyond the placeholder, and no
backend. The household model already exists (`groups`, `memberships`, `users` in
`convex/schema.ts`; `convex/lib/sharing.ts` for group-scoped visibility), which this design reuses
for list ownership. There is no existing OAuth/external-integration code anywhere in the app to
build on — this is the first feature that talks to a third-party API.

---

## 2. Decisions (locked)

| Decision | Choice |
|---|---|
| Sync direction | One-way pull only. External providers are read-only mirrors; edits happen in the provider's own app |
| Sync trigger | On-demand: fetched live via a Convex action when a list is opened, plus a manual "Refresh" button. No cron/background jobs, no cached copy of external tasks |
| List model | A group has 0+ task lists; each list has exactly one provider (`local`, `notion`, or `todoist`) — not a merged view |
| Connection ownership | Per-group, not per-user. One Notion connection and one Todoist connection per group; any list in that group can link to any source visible to that connection |
| Connection management | A global "Connections" section on `/settings`, not inside the Tasks module — connections are module-agnostic (the same Notion connection will later serve Notes and Calendar). Tasks only *consumes* connections; connect/disconnect lives in settings, with an inline "connect now" shortcut from the Add-list flow for convenience |
| Multiple connections per provider | Not offered in the UI this pass (one Notion + one Todoist connection per group), but not blocked by the data model: every linked list references its own connection by `connectionId`, never by a `(groupId, provider)` lookup. Allowing multiple Notion connections later — whether split by module (Tasks vs Notes) or per individual list (two task lists pulling from two different Notion workspaces) — is a UI-only change (settings allows "add another connection"; the Add-list flow gains a connection picker when more than one exists) with no migration |
| Notion property mapping | User-driven at link time — gather fetches the database's property schema and the user maps title/done/due-date (optionally priority/labels) to it, since Notion databases have arbitrary schemas |
| Todoist mapping | None needed — Todoist's task shape is fixed (title, done, due date, priority, labels are native fields) |
| Unified task shape | `{ externalId, title, done, dueDate?, priority?, labels? }` — extended beyond the bare minimum specifically so Todoist's native priority/labels aren't dropped |
| Write capability | Local lists are fully editable (including priority/labels). External lists are read-only in this pass; `capabilities.write` exists on the adapter interface as a documented future extension point, not implemented now |

---

## 3. Architecture: the adapter interface

A **task-provider adapter** is a server-side (Convex) module, one per provider, implementing:

```ts
interface TaskProviderAdapter {
  id: 'local' | 'notion' | 'todoist'
  capabilities: {
    write: boolean
    priority: boolean
    labels: boolean
  }
  // Notion: databases the connection can see. Todoist: projects. Local: unused.
  listAvailableSources(connection): Promise<{ id: string; name: string }[]>
  // Notion only — its databases have arbitrary properties that need mapping.
  // Todoist/local return a fixed/no-op schema.
  getSourceSchema(connection, sourceId): Promise<{ id: string; name: string; type: string }[]>
  fetchTasks(connection, sourceConfig): Promise<UnifiedTask[]>
}

type UnifiedTask = {
  externalId: string
  title: string
  done: boolean
  dueDate?: string
  priority?: 1 | 2 | 3 | 4
  labels?: string[]
}
```

The `local` adapter's `fetchTasks` queries the `tasks` Convex table directly rather than calling an
external API — same interface, so list rendering and the refresh action never branch on provider.
A single generic Convex action, `taskLists.getTasks(listId)`, loads the list's `provider` field,
picks the matching adapter module, and returns `UnifiedTask[]`. Adding a future provider (e.g.
Outlook) means writing one new adapter module and registering it; nothing else in the module
changes.

---

## 4. Data model (`convex/schema.ts` additions)

```ts
taskLists: defineTable({
  groupId: v.id('groups'),
  name: v.string(),
  provider: v.union(v.literal('local'), v.literal('notion'), v.literal('todoist')),
  providerConfig: v.optional(v.object({
    connectionId: v.id('integrationConnections'),
    sourceId: v.string(), // Notion database id / Todoist project id
    propertyMapping: v.optional(v.object({
      title: v.string(),
      done: v.string(),
      dueDate: v.optional(v.string()),
      priority: v.optional(v.string()),
      labels: v.optional(v.string()),
    })),
  })),
  order: v.number(),
}).index('by_group', ['groupId']),

tasks: defineTable({
  listId: v.id('taskLists'),
  title: v.string(),
  done: v.boolean(),
  dueDate: v.optional(v.string()),
  priority: v.optional(v.union(v.literal(1), v.literal(2), v.literal(3), v.literal(4))),
  labels: v.optional(v.array(v.string())),
  createdBy: v.id('users'),
  order: v.number(),
}).index('by_list', ['listId']), // local lists only

integrationConnections: defineTable({
  groupId: v.id('groups'),
  provider: v.union(v.literal('notion'), v.literal('todoist')),
  accessToken: v.string(), // server-only; never returned by any query
  accountLabel: v.string(), // e.g. Notion workspace name / Todoist account email
  connectedBy: v.id('users'),
}).index('by_group_provider', ['groupId', 'provider']),
```

`accessToken` is only read inside Convex actions/adapters, never selected into a client-facing
query result — same boundary discipline as any other server secret in this app.

Linked lists resolve their connection via `providerConfig.connectionId`, never by looking up "the
group's connection for this provider". The UI enforces one connection per provider per group this
pass, but the data model deliberately doesn't — see the decisions table (§2).

---

## 5. Connections settings, OAuth & linking flow

### 5.1 Global Connections settings

`/settings` (currently just `AppearanceSettings` from `@appelent/auth`) gains a **Connections**
section listing the group's external connections. Per provider it shows: connected state,
`accountLabel` (workspace name / account email), who connected it, and Connect / Disconnect
actions. This is deliberately module-agnostic — `integrationConnections` rows carry no module
reference, so the same Notion connection will later serve the Notes and Calendar modules without
schema or settings-UI changes (only the `provider` union grows as new providers are added).
Disconnecting warns that any lists linked through that connection will stop loading until
reconnected (the rows stay; they surface the reconnect prompt from §7).

### 5.2 OAuth

- Connecting Notion or Todoist for a group is a one-time OAuth flow per provider, initiated from
  the Connections settings section (or the inline shortcut in the Add-list flow below). The
  callback is a TanStack Start server route (e.g.
  `src/routes/api/integrations/notion/callback.ts`, `.../todoist/callback.ts`) that exchanges the
  auth code for a token and calls an internal Convex mutation to upsert the
  `integrationConnections` row — this app's Clerk sign-in already lives alongside Convex the same
  way, so this isn't a new pattern for the codebase.

### 5.3 Linking a list

- Linking a list:
  1. User picks "Add list" → chooses provider. If external and the group has no connection yet,
     shows an inline "Connect Notion" / "Connect Todoist" button (same OAuth flow as settings;
     returns the user to the Add-list flow afterwards).
  2. Convex action calls `listAvailableSources` (Notion databases / Todoist projects); user picks
     one.
  3. **Notion only:** action calls `getSourceSchema`; user maps title/done/due-date (and optionally
     priority/labels) to the database's actual property names. Todoist skips this step entirely.
  4. `taskLists` row is created with `provider` + `providerConfig`.

---

## 6. UI/UX (Tasks module)

- `/tasks` replaces the placeholder with the group's task lists (0+), each labeled by provider.
- **Local lists:** full CRUD — add, edit, check off, delete, reorder; priority and labels editable
  inline.
- **External lists (Notion/Todoist):** read-only rows, fetched live on page open via
  `taskLists.getTasks`; a manual "Refresh" button re-fetches; each row links out to open the item
  in its source app. No inline editing controls are rendered for these lists.
- "Add list" flow covers both local (name only) and external (provider connect/select/map, per §5).
- Connection management itself (connect/disconnect, connection status) lives on `/settings` per
  §5.1, not on the Tasks page.

---

## 7. Error handling

- Expired/revoked provider token → the list shows a "Reconnect Notion/Todoist" prompt instead of a
  raw error, and doesn't block other lists in the group from loading.
- Provider API error or rate limit on fetch → inline error message on that list with a retry
  action; local lists are unaffected.
- A Notion database whose mapped property was deleted/renamed after linking → treated the same as
  an API error (surfaced inline), not a crash; re-linking re-runs the mapping step.

---

## 8. Testing

- Adapter `fetchTasks`/mapping logic as pure-function unit tests per provider (mocked Notion and
  Todoist API responses), following the existing `convex/lib/*.test.ts` pattern (e.g.
  `recipeParsing.test.ts`).
- `taskLists.getTasks`: dispatches to the correct adapter per `provider`, returns `UnifiedTask[]`
  in all three cases.
- Local list CRUD (`tasks.ts` mutations): create/update/toggle-done/delete/reorder, scoped to
  `listId`.
- Reconnect-prompt path: adapter fetch simulating an expired-token error surfaces the reconnect
  state rather than throwing.

---

## 9. Out of scope (this pass)

- Calendar and Notes modules — separate specs, reusing this pattern where it fits rather than
  inheriting it wholesale.
- Two-way sync / writing back to Notion or Todoist (`capabilities.write` stays `false` for both;
  the field exists in the interface for a future pass).
- Background/scheduled sync (cron) and any local caching of external tasks.
- Additional providers (Outlook Tasks/Calendar, other to-do apps) — the interface is designed to
  make adding one straightforward, but none beyond Notion and Todoist are implemented here.
- Subtasks/parent-child task relationships, even though Todoist supports them natively — not part
  of the unified shape in this pass.
