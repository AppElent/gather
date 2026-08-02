# 0004 — Tasks and integrations onto Group scope

Puts a task list, its tasks and a provider connection in the Group whose
Members should share them, taken from the URL rather than from the account's
stored default. Refs #26.

**There is no schema change and nothing to run.** `taskLists.groupId` and
`integrationConnections.groupId` have been required `v.id('groups')` since both
tables shipped, so there is no expand–contract here and no backfill. What
changed is who may read a row, not what a row looks like.

**Nothing here is destructive, and nothing here is automatic.** This migration
is a deploy and a look. Rows that end up in the wrong Group are deleted and
recreated rather than moved — see below for why that is the right answer here
and was not the right answer for the baby log.

| Step | What | Reversible? |
| --- | --- | --- |
| 1 | Deploy | — nothing is written by the deploy |
| 2 | Open each Group's Tasks page and settings, and look | nothing written |
| 3 | Delete and recreate anything in the wrong Group | the delete is not |

## Before anything here: 0001, 0002 and 0003

This ships in the same branch as the other three and step 1 deploys all four
tickets' schema at once. Convex validates the whole schema against the rows on
the deployment and rejects the deploy as a whole if any row does not fit, so run
0001, 0002 and 0003 first on any deployment that has not had them. Nothing in
*this* migration can be the reason a deploy is rejected: the task and
integration tables do not change shape.

## 1. Deploy

```sh
pnpm run deploy:dev    # dev
pnpm run deploy:prod   # prod
```

What it changes is the app. `taskLists.list`, everything in `tasks`, and every
public function in `integrations` now take the Group from the URL and refuse
anything else — including from a Member of the row's own Group who asks under a
different Group's slug. `users.defaultGroupId` is read by none of them any
more, and `groupIdFromSlugOrDefault` is gone.

Connections also move page: they were on `/settings` and are now on
`/g/<slug>/settings`, one page per Group. `/settings` keeps a card linking to
each of yours.

## 2. What you will see if a row is in the wrong Group

A list or a connection created before this branch sits in whatever Group
`defaultGroupId` pointed at when it was made. That meant "the last Group I
picked" before #17 and "my Personal group" after it, so **it may well be
somebody's Personal group rather than the household everyone expected**.

The symptom is quiet, and worth recognising:

- **A household's Tasks page looks empty.** `/g/jansen-household/tasks` says
  "No lists yet" and offers to create the first one — while the lists are still
  there, in one person's Personal group, reachable at `/g/me-alice/tasks` by
  that person and by nobody else. Nothing is lost and nothing says so.
- **A household's connections look absent.** `/g/jansen-household/settings`
  shows Notion and Todoist as "Not connected", and connecting again from there
  is the fix. The old connection is still in whichever Group it was made in.
- **A linked list says it needs reconnecting.** A list whose Group has no
  connection for its provider shows the reconnect prompt, which now points at
  that Group's settings.

Check each Group by opening it. There is no verification command for this and
deliberately so: the answer is one page load per Group, and a query that
reported it would be a third place for the rule to be written down.

## 3. Delete and recreate — do not move

Task and integration data is disposable, which is why #26 could take required
ownership fields from the first commit. A list is a name and a handful of
titles; a connection is an OAuth round trip that takes about ten seconds.
Reconstructing either by hand is cheap, and every alternative is not:

- A **connection** cannot sensibly be moved anyway. The token is the household's
  because the household authorised it; carrying somebody's personal Notion token
  into a shared Group makes it readable by everyone in that Group, which is a
  privacy change nobody asked for. Disconnect it where it is, and connect it
  again from the Group's settings page — the new one is attributed to whoever
  does that and belongs to the Group they did it from.
- A **list** could be moved by one `groupId` patch, and its tasks would follow —
  they hang off the list. But a mutation to do it would have the same problem
  0003's does: which Group a row belongs in is not inferable from the data, so
  the operator has to name both ends anyway. For irreplaceable time-series that
  trade was worth it. For a to-do list it is not: the tool costs more than the
  retyping, and it would sit in `maintenance.ts` afterwards being the one
  written-down way to move content between Groups without going through the
  access rules.

So:

- **A list in the wrong Group.** Recreate it in the right Group from
  `/g/<slug>/tasks` and retype its open tasks. Delete the old one from the Group
  it is in. If it was a linked list, connect the provider for the new Group
  first, then add the list — it will mirror the same Notion database or Todoist
  project as before.
- **A connection in the wrong Group.** Disconnect it on that Group's settings
  page, then connect it from the right Group's. Any linked list in the new Group
  picks up the new connection automatically; `storeConnection` repoints the
  lists in its own Group at it.

None of this is urgent. A row in the wrong Group is invisible to the wrong
people, not visible to too many: the tightening in step 1 only ever refuses.

## Notes

- Being a Member of the Group in the URL is not enough on its own any more. A
  Member of both households asking for one household's list under the other
  household's slug is refused exactly like a stranger, and "no such list" and
  "not in this Group" are one answer so that neither reveals the other.
- A connection's `accessToken` is server-only and has always been; #26 keeps it
  that way and adds a test that says so over every public function's output.
- `convex/lib/groupAccess.ts`'s `groupIdFromSlugOrDefault` is gone. `taskLists`
  and `integrations` were its last two callers, as 0003 said they were.
- The old owner-or-shared-group visibility helper, `isVisibleTo`, was already
  removed by #19 in favour of `isVisibleToGroups`. `isVisibleToGroups` and
  `getMyGroupIds` stay: recipes, the food diary and the Groups list still need
  them, and the diary is caller-wide on purpose (ADR-0003).
