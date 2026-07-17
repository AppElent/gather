# Clerk Spaces Setup

Gather Spaces are backed by Clerk Organizations and Convex `spaces` records.

Required development configuration:

1. Enable Clerk Organizations.
2. Keep Personal Accounts enabled.
3. Keep Organization membership optional in the shared Clerk application.
4. Do not enable Clerk's membership-required session task.
5. Gather authorizes only Organization Admin (`org:admin`) and Member (`org:member`) roles. Do not delete, rename, or restrict other shared roles that may belong to another app.
6. Add `org_id: {{org.id}}` and `org_role: {{org.role}}` to the shared `convex` JWT template only after the compatibility checks in `clerk-shared-application.md` pass.
7. Preserve all existing JWT template claims and settings.
8. Before continuing with Gather rollout, sign in to the shared Clerk development instance, activate a test Organization, request the `convex` token, decode its payload locally without recording the token body, and verify `org_id` and `org_role` match the active Organization and role.
9. Configure the Clerk webhook URL once Task 5 adds the webhook action, and save its signing secret as `CLERK_WEBHOOK_SIGNING_SECRET` in Convex.
10. Save `CLERK_SECRET_KEY` in the Convex deployment for backend Organization administration actions.

Never commit Clerk secret keys, webhook secrets, JWT bodies, or real token values.
