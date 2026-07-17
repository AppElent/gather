# Shared Clerk Application Notes

Gather uses a Clerk application that may also serve other webapps. Gather must therefore isolate its own resources instead of treating every Clerk Organization as a Gather Space.

Shared-instance constraints:

1. Organizations are enabled and membership remains optional.
2. Personal Accounts remain enabled.
3. Automatic first Organization creation stays disabled.
4. Shared Clerk roles remain unchanged. Gather uses only Admin (`org:admin`) and Member (`org:member`).
5. Gather Organizations carry this public metadata marker: `{ "gather": { "kind": "space", "schemaVersion": 1 } }`.
6. Gather invitations carry this public metadata marker: `{ "gather": { "kind": "spaceInvitation", "schemaVersion": 1 } }`.
7. The shared `convex` JWT template may receive only additive `org_id` and `org_role` claims after all known consumers pass compatibility smoke tests.
8. Other apps that display Organizations should apply their own namespace filter.
9. Never paste JWT bodies, publishable keys, secret keys, webhook secrets, user data, or Organization IDs into this document.

Compatibility inventory and smoke-test results must be recorded here before changing the shared Clerk development instance.
