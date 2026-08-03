# 0001 — Group slugs and Personal groups

Backfills `groups.slug`, `groups.isPersonal`, everyone's Personal group, the
`owner` → `admin` role rename, and the removal of `groups.type`. Refs #17.

This is an expand–contract migration, so it is **two deploys with a backfill in
between**. The middle step is not optional: Convex validates the schema against
existing rows when a deploy pushes it, so the tightening deploy fails outright
if any row is still missing a slug.

| Step | What | Reversible? |
| --- | --- | --- |
| 1 | Deploy the expand commit — `slug`/`isPersonal` optional, role union widened to accept `owner` | yes |
| 2 | Run the backfill dry, read the summary | nothing written |
| 3 | Run the backfill with `apply: true` | no |
| 4 | Verify | — |
| 5 | Deploy the tightening commit — `slug`/`isPersonal` required, role narrowed, `type` dropped | no |

## 1. Deploy the expand commit

```sh
pnpm run deploy:dev    # dev
pnpm run deploy:prod   # prod
```

The app keeps working unchanged at this point: nothing reads a slug yet, and
routes are untouched.

## 2. Dry run

The backfill is dry by default — it reports what it would do and writes
nothing.

```sh
# dev
pnpm exec convex run maintenance:backfillGroupSlugsAndPersonalGroups '{}'

# prod
pnpm exec convex run --prod maintenance:backfillGroupSlugsAndPersonalGroups '{}'
```

It prints:

```jsonc
{
  "apply": false,
  "rolesMigrated": 4,          // memberships still carrying role 'owner'
  "groupsMarkedPersonal": 3,   // Groups about to be marked as someone's Personal group
  "groupsMarkedShared": 2,     // Groups about to be marked as ordinary
  "slugsAssigned": 5,          // Groups about to get a slug
  "droppedTypeFields": 3,      // Groups still carrying the removed `type` field
  "personalGroupsCreated": 1,  // people who have no Personal group yet
  "defaultGroupsRepointed": 0  // people whose defaultGroupId pointed somewhere else
}
```

Sanity-check before applying:

- `groupsMarkedPersonal + groupsMarkedShared` equals the number of Groups.
- `slugsAssigned` equals the number of Groups (none has a slug yet).
- `groupsMarkedPersonal + personalGroupsCreated` equals the number of users —
  every person ends up with exactly one Personal group.

If `personalGroupsCreated` is larger than expected, that is a person whose
`defaultGroupId` pointed at a shared Group rather than at the `Home` group
signup made for them. They get a new, empty Personal group; their old `Home`
group survives as an ordinary Group.

## 3. Apply

```sh
# dev
pnpm exec convex run maintenance:backfillGroupSlugsAndPersonalGroups '{"apply":true}'

# prod
pnpm exec convex run --prod maintenance:backfillGroupSlugsAndPersonalGroups '{"apply":true}'
```

## 4. Verify

Re-run the dry version from step 2. Every count must now be `0` — the backfill
is idempotent, and a second pass finding work left to do means the first pass
did not finish.

Then spot-check in the Convex data browser:

- every `groups` row has a non-empty `slug` and a boolean `isPersonal`;
- no `groups` row still has a `type` field — one that does will be rejected by
  the tightening deploy, because Convex refuses a document carrying a field its
  schema does not describe;
- no two rows share a `slug`;
- no `memberships` row still has `role: "owner"`;
- every `users` row has a `defaultGroupId`, pointing at a Group whose
  `isPersonal` is `true`.

## 5. Deploy the tightening commit

```sh
pnpm run deploy:dev
pnpm run deploy:prod
```

`slug` and `isPersonal` become required, the role union narrows to
`admin | member`, and the unused `groups.type` field is dropped. If this deploy
is rejected with a schema validation error, a row was missed — go back to
step 3.

## Notes

- The backfill treats a Group as Personal exactly when it has a single Member
  and that Member's `defaultGroupId` points at it. That is a precise
  description of the `Home` group signup used to create, and of nothing else.
- A backfilled Personal group keeps its existing name (`Home`); only new ones
  are called "<person>'s things". Its slug comes from the person's name, not
  from "Home", so slugs read as `me-alice` rather than `me-home-4`.
- `defaultGroupId` changes meaning here: it used to be "the last Group I
  picked" and now means "my Personal group". Anything still reading it as the
  active Group — `babies`, `taskLists`, `integrations`, and the default share
  target in `recipes` — therefore scopes itself to the caller's Personal group
  until #18 puts the Group in the URL. For everyone whose `defaultGroupId`
  already pointed at their `Home` group, that is exactly the Group it pointed
  at before, so nothing moves.
