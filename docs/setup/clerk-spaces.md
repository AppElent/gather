# Clerk Spaces Setup

Gather Spaces are backed by marked Clerk Organizations and Convex `spaces`
records. This setup is safe only after the compatibility gate in
`clerk-shared-application.md` has passed.

## Required development configuration

1. Enable Organizations while keeping membership optional and Personal Accounts
   enabled.
2. Disable automatic first-Organization creation and Clerk’s membership-required
   session task.
3. Gather authorizes only `org:admin` and `org:member`; leave all other shared
   roles and Role Sets unchanged.
4. Preserve every existing `convex` JWT template claim and add only `org_id` and
   `org_role` after the shared-app compatibility evidence is complete.
5. Store `CLERK_JWT_ISSUER_DOMAIN`, `CLERK_SECRET_KEY`, and
   `CLERK_WEBHOOK_SIGNING_SECRET` as Convex deployment environment values. Never
   commit their values.
6. Configure Clerk webhooks to POST to `/clerk-webhook`. Gather acknowledges
   unrelated events without writes and projects only marked resources.

## Rollout verification status

As of 2026-07-20, live Clerk dashboard configuration and the two-user acceptance
matrix are **pending**. They require the authoritative shared-consumer inventory,
test users, and permission to change the shared Clerk development instance. No
external Clerk resource was created, renamed, remapped, restricted, or deleted by
this implementation task.

When authorized, verify active Organization claims locally without recording
claims values or tokens, then run the Space acceptance matrix from the implementation
plan. Record only timestamps, check names, and PASS/FAIL outcomes.
