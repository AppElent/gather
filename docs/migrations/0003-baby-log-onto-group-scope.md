# 0003 — The baby log onto Group scope

Puts each child in the Group whose Members should share their log, so both
parents see one log and log into it. Refs #20.

**This is the one migration in the rebuild that touches data nobody can
re-enter.** A baby's entries are time-series about a real child; there is no
acceptable amount of loss, and no way to type them back in. Read the whole of
this file before running anything in it.

**Nothing here is destructive.** There is no schema change — `babies.groupId`
has been a required `v.id('groups')` since the Baby log first shipped — and no
expand–contract to do. Events reference `babyId`, not `groupId`, so a child's
entire log follows the child: moving one baby is **one `groupId` patch on one
row**, and not a single event row is written, reordered or read for its
contents. That is the strongest guarantee available that payloads and
timestamps come through unchanged, and it is why this migration is small.

The two aux `taskLists` behind a child's to-do and questions cards move with
them, so they do not end up in a Group the child no longer lives in.

## Before anything here: 0001 and 0002 must already have run

This migration ships in the same branch as `0001-group-slugs-and-personal-groups.md`
and `0002-recipes-become-group-owned.md`, and step 1 below deploys **all three**
tickets' schema at once. Convex validates the whole schema against the rows
already on the deployment, so that deploy is rejected outright — writing nothing
— while a single Group is missing `slug` or `isPersonal`, or a single recipe
still carries `ownerId`.

So on any deployment that has not had them: run 0001 end to end, then 0002, and
only then step 1 here. On a deployment that has had them, step 1 is the ordinary
deploy it looks like.

A rejected deploy is safe — it is refused as a whole and nothing changes — but
it is not a step in this migration, and hitting one here means the prerequisites
were skipped rather than that something is wrong with the baby log.

| Step | What | Reversible? |
| --- | --- | --- |
| 1 | Deploy — **after** 0001 and 0002 | — nothing is written by the deploy |
| 2 | Verify, and **keep the output** | nothing written |
| 3 | Decide which child belongs in which Group | — |
| 4 | Run the move dry, per child, read the summary | nothing written |
| 5 | Run the move with `apply: true`, per child | yes — move it back the same way |
| 6 | Verify again, and diff against step 2 | nothing written |

## Which Group is not something the migration can work out

`defaultGroupId` meant "the last Group I picked" before #17 and "my Personal
group" after it. `babies.create` used it until #18. So a child's current Group
may be the household one, may be a parent's Personal group, and **nothing in
the data says which was meant**. `moveBabyToGroup` therefore takes the child
*and* the target Group as arguments and guesses nothing.

If step 2 shows every child already in the Group whose Members should share
their log, **the correct outcome of this migration is that nothing is moved**.
Steps 4 and 5 are skipped, and that is a success, not a missed step.

## 1. Deploy

```sh
pnpm run deploy:dev    # dev
pnpm run deploy:prod   # prod
```

Nothing in the *baby* tables changes shape, so no baby or event row can be the
reason this deploy is rejected — and the deploy writes nothing either way. It
can still be rejected for the Groups and recipes this branch's schema also
tightens, which is what the prerequisites above are about.

What it changes is the app: every baby query and
mutation now takes the Group from the URL and refuses anything else. Until a
child is in the Group its Members expect, that Group's pages will say there is
no such child — which is the state steps 4 and 5 fix.

## 2. Verify

The verification is a **query**. It writes nothing, ever, and can be run as
often as you like.

```sh
# dev
pnpm exec convex run maintenance:verifyBabyLogScope '{}'

# prod
pnpm exec convex run --prod maintenance:verifyBabyLogScope '{}'
```

It prints:

```jsonc
{
  "totals": {
    "groups": 3,
    "babies": 1,
    "events": 412,
    "eventsWithoutBaby": 0   // entries hanging off a child that no longer exists
  },
  "groups": [                // sorted by slug, so two runs list them alike
    {
      "slug": "jansen-household",
      "isPersonal": false,
      "members": 2,
      "babies": 0,
      "babyNames": [],
      "events": 0
    },
    {
      "slug": "me-alice",
      "isPersonal": true,
      "members": 1,
      "babies": 1,
      "babyNames": ["Noor"],
      "events": 412
    }
  ],
  "sampleSize": 20,
  "sample": [                // the 20 oldest entries, oldest first
    {
      "baby": "Noor",
      "type": "feeding",
      "timestamp": 1760000000000,
      "loggedBy": "jd7abc…",
      "dataDigest": "9f2c1a04c31be5d7"
    }
    // …
  ]
}
```

**Save this output to a file.** Step 6 diffs against it, and a verification you
did not keep is a verification you did not do.

```sh
pnpm exec convex run --prod maintenance:verifyBabyLogScope '{}' > before.json
```

Read it before going on:

- `totals.events` is the number of entries that must still be there at the end.
- `totals.eventsWithoutBaby` should be `0`. Anything else is a pre-existing
  orphan and is not something this migration created or will fix — investigate
  it before moving anything.
- The Group holding the children is very likely a **Personal group**
  (`isPersonal: true`, `members: 1`). That is the symptom: one parent's private
  Group is holding the household's log.
- The `sample` is the twenty *oldest* entries. Oldest on purpose: they are the
  part of the log most at risk and least replaceable, and a feed logged while
  you are working lands at the far end and cannot shift them. `dataDigest` is a
  fingerprint of the entry's payload — same payload, same digest.

## 3. Decide the destination

For each child in the output, decide which Group's Members should share their
log, and note that Group's `slug`. Usually that is the household Group both
parents are in — the one with `isPersonal: false` and `members: 2` — but it is
your call, not the migration's.

You also need each child's id. From the Convex data browser: **Data →
`babies`**, and copy the `_id`.

## 4. Run the move dry

Dry by default: it reports what it would do and writes nothing.

```sh
# dev
pnpm exec convex run maintenance:moveBabyToGroup \
  '{"babyId":"<baby id>","toGroupSlug":"jansen-household"}'

# prod
pnpm exec convex run --prod maintenance:moveBabyToGroup \
  '{"babyId":"<baby id>","toGroupSlug":"jansen-household"}'
```

It prints:

```jsonc
{
  "apply": false,
  "baby": { "id": "jd7…", "name": "Noor" },
  "from": { "slug": "me-alice", "name": "Alice's things", "isPersonal": true, "members": 1 },
  "to": { "slug": "jansen-household", "name": "Jansen Household", "isPersonal": false, "members": 2 },
  "alreadyInTargetGroup": false,
  "babiesMoved": 1,
  "taskListsMoved": 2,     // the to-do and questions lists follow the child
  "taskListsMissing": 0,
  "eventsCarried": 412,    // entries that follow the child…
  "eventsRewritten": 0     // …none of which is written
}
```

Check, before applying:

- `to.slug` is the Group you meant, and `to.members` is the number of people who
  should be able to read this child's log.
- `to.isPersonal` is `false`. The move **reports** a Personal target rather than
  refusing it — a Personal group is an ordinary Group and there are reasons to
  choose one — but if you did not mean it, this is where you notice.
- `eventsCarried` matches the entry count for that child in step 2.
- `eventsRewritten` is `0`. It is always `0`: the events are not touched.

It refuses outright, writing nothing, if the target slug names no Group, or
names a Group with no Members — nobody could read the log from there.

## 5. Apply

One child at a time, so each summary can be read.

```sh
# dev
pnpm exec convex run maintenance:moveBabyToGroup \
  '{"babyId":"<baby id>","toGroupSlug":"jansen-household","apply":true}'

# prod
pnpm exec convex run --prod maintenance:moveBabyToGroup \
  '{"babyId":"<baby id>","toGroupSlug":"jansen-household","apply":true}'
```

This is reversible: to undo it, run the same command with the *old* slug as
`toGroupSlug`.

## 6. Verify again — and stop if it does not match

```sh
pnpm exec convex run --prod maintenance:verifyBabyLogScope '{}' > after.json
diff before.json after.json
```

**If anything other than the per-Group counts has changed, stop.** Do not run
anything else, do not "fix it up", and do not go on to the next child. The move
is reversible by moving the child back, and a stopped migration with the data
intact is the good outcome.

Exactly two things are allowed to differ:

- the `babies` and `events` counts on the two Groups involved — one loses them,
  the other gains them, and the two totals are unchanged;
- nothing else. `totals` must be identical. Every line of `sample` must be
  identical — same `baby`, same `type`, same `timestamp`, same `loggedBy`, same
  `dataDigest`.

`loggedBy` staying put is the point of checking it: attribution records *who*
did the night feed and is not rewritten by a move, and it never granted access
in the first place (ADR-0003).

Then re-run the move dry, for a child already moved:

```sh
pnpm exec convex run --prod maintenance:moveBabyToGroup \
  '{"babyId":"<baby id>","toGroupSlug":"jansen-household"}'
```

It must now report `alreadyInTargetGroup: true`, `babiesMoved: 0` and
`taskListsMoved: 0`. The move is idempotent, and a second pass finding work left
to do means the first did not finish.

Finally, open the app as **each parent in turn**:

- `/g/jansen-household/baby` lists the child for both of them;
- the child's page shows the same entries for both, with the same times;
- each can log an entry, and the timeline shows both parents' entries together;
- the to-do and questions cards are still there, with their tasks.

## Notes

- `/g/<other-group>/baby/<id>` now answers "not found" for a child who does not
  live in that Group, even for someone who can see that child from a Group of
  their own. Being a Member of the Group in the URL is no longer enough on its
  own; the URL has to be telling the truth about the child as well.
- A parent whose Personal group used to hold the log loses their private view of
  it, because the log now lives in the household Group. That is the point, not a
  regression — privacy is a consequence of which Group something lives in
  (ADR-0003), and this child's log is meant to be shared.
- `convex/lib/groupAccess.ts`'s `groupIdFromSlugOrDefault` is no longer used by
  anything in the Baby log. It stays in place for `taskLists` and
  `integrations`, which are #26.
