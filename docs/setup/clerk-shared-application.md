# Shared Clerk Application Notes

Gather uses a Clerk application that may also serve other webapps. Gather must
isolate its own resources instead of treating every Clerk Organization as a
Gather Space.

## Shared-instance constraints

1. Organizations are enabled and membership remains optional.
2. Personal Accounts remain enabled.
3. Automatic first Organization creation stays disabled.
4. Shared Clerk roles remain unchanged. Gather uses only Admin (`org:admin`) and
   Member (`org:member`).
5. Gather Organizations carry `{ "gather": { "kind": "space", "schemaVersion": 1 } }`
   in public metadata.
6. Gather invitations carry `{ "gather": { "kind": "spaceInvitation", "schemaVersion": 1 } }`
   in public metadata.
7. The shared `convex` JWT template may receive only additive `org_id` and
   `org_role` claims after all known consumers pass compatibility smoke tests.
8. Never record JWT bodies, publishable or secret keys, webhook secrets, user
   data, Organization IDs, or token values here.

## Compatibility evidence — blocked pending owner inventory

Status recorded 2026-07-20: **blocked before shared Clerk configuration changes**.
The repository does not establish the authoritative list of webapps that use this
Clerk application, and this task has no authority to inspect or mutate the shared
Clerk dashboard. Do not assume Gather is the only consumer. Obtain the owner’s
app list, then record one row per app with only: repository/app name, development
URL, Organization UI usage, `convex` JWT usage, authenticated smoke path, and
before/after timestamped PASS or FAIL status.

Before the additive template change, each app must complete its authenticated
smoke path. For an app using `convex`, decode a development token locally and
record claim *names only*. Repeat the same matrix after the change, including a
sign-in without an active Organization for non-Gather apps. Any failed result
requires restoring the prior development configuration and blocks rollout.

## Gather negative controls — pending shared-instance access

After the compatibility matrix passes, use an unmarked Organization and
invitation alongside marked Gather equivalents. Confirm Gather projects, lists,
reconciles, renames, and deletes only marked resources, then rerun every other
app’s smoke path. Record outcomes here without identifiers or credentials.
