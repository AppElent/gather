# A variable declares its consumer, not its destination

Status: accepted (2026-08-09)

`env.manifest.ts` lists every environment variable gather needs. An entry says
**who reads the value** — the Vite build, a Worker server function, a Convex
function, the workflow itself — and the environments it is needed in. It does
*not* say where the value must be written. A single table derives that from
(consumer, environment):

| consumer | local | preview | stg | production |
|---|---|---|---|---|
| `vite-build` | `.env.local` | GitHub repo | GitHub env `stg` | GitHub env `production` |
| `build-tooling` | `.env.local` | GitHub repo | GitHub env `stg` | GitHub env `production` |
| `local-tooling` | `.env.local` | — | — | — |
| `worker-runtime` | `.dev.vars` | `gather-pr-<N>` | `gather-stg` | `gather` |
| `convex-functions` | your `convex dev` | `--type preview` default | convex `staging` | convex prod |
| `workflow` | — | GitHub repo | GitHub env `stg` | GitHub env `production` |

`scripts/env.mjs check` compares that with reality; `apply` writes it.

## Why not declare the destination

Because the destination is the part people get wrong, and declaring it means
writing it out once per environment per variable — four nearly identical rows
saying "wherever the build reads env from, here". A wrong row looks exactly like
a right one.

This is not a hypothetical. Every one of these was found in the codebase when
the manifest was written, and each is a cell of the table above that somebody
re-derived from memory:

- `preview.yml` passed `--var "VITE_CLERK_PUBLISHABLE_KEY:…"` to `wrangler
  deploy` — a `worker-runtime` cell filled in for a value whose consumer is
  `vite-build`. Nothing in `src/` reads a Worker binding; all three `VITE_*`
  reads go through `import.meta.env`, i.e. inlined at build. Its three-line
  comment justified it as overriding `wrangler.jsonc`'s top-level `vars`, which
  does not exist.
- No Worker secret was ever set on `gather-pr-<N>`, `gather-dev` or the new
  `gather-stg` — three empty `worker-runtime` cells — so the in-app issue
  reporter answered "GitHub issue reporter is not configured." everywhere but
  production. No test could notice: the code is correct, the value was absent.
- `README.md` documented that `vars` block too.
- `.gitignore` reserved `.env.dev`, `.env.preview` and `.env.prod`, which nothing
  read, and whitelisted a `.dev.vars.example` that did not exist.
- `src/env.ts` declared `SERVER_URL` and `VITE_APP_TITLE`, which nothing read.

Under a destination-shaped model each of these stays expressible. Under a
consumer-shaped one they are not: there is one table, in one place, and it is
either right for everything or visibly wrong.

## What one entry is

One entry is one **logical value**, not one variable name. A value may reach two
consumers under two names, and the entry holds both:

```ts
{
  key: 'sampleDataEnabled',
  lands: {
    'convex-functions': { name: 'ENABLE_SAMPLE_DATA',      environments: ['local', 'preview', 'stg'] },
    'vite-build':       { name: 'VITE_ENABLE_SAMPLE_DATA', environments: ['local', 'preview', 'stg'] },
  },
}
```

The Convex copy gates the mutation and the Vite copy shows the panel. If they
disagree you get a visible Sample-data panel whose button always throws. As one
entry they cannot disagree. As two entries — which is what a name-keyed model
gives you — nothing relates them at all.

The same shape carries "absent by design": `production` is missing from both
lists, so `apply production` never considers these, and `check production`
finding `VITE_ENABLE_SAMPLE_DATA` *present* reports it as an extra. Previously
that rule lived in a `deploy.yml` expression whose own comment warned that the
opposite polarity "would evaluate to `'true'` on **production**, which is the
one thing it must not do".

## Why secrecy is declared and type-enforced

A value the Vite build reads cannot be secret: the build inlines it into a bundle
anyone can download, and this repository is public. The type makes `secret: true`
alongside a `vite-build` landing a compile error.

That forces one honest reclassification. `VITE_TEST_USER_PASSWORD` was stored as
a GitHub secret; it is inlined into a bundle served at a public preview URL, so
the secrecy was theatre. It is now declared published, and what contains the
blast radius is the thing that always actually contained it: the account exists
only on the Clerk test instance.

Secrecy is *declared* rather than derived from the `VITE_` prefix, because
`CLERK_JWT_ISSUER_DOMAIN`, `GITHUB_REPOSITORY_OWNER`, `GITHUB_REPOSITORY_NAME`
and `ENABLE_SAMPLE_DATA` carry no prefix and are entirely public. Deriving would
call them secret, which would keep them out of a committed file and cost most of
the onboarding benefit. `build-tooling` exists for the converse case:
`SENTRY_AUTH_TOKEN` is read by the build and never inlined, because it has no
prefix.

## Where values live

Committed `env/<environment>.public.env`, ignored `env/<environment>.secret.env`.

Committing the public half publishes it to a public repo, deliberately. None of
it is confidential — a Clerk publishable key is designed to be published, a
Convex URL ships in every bundle — and `.cta.json` had already committed two of
these values by accident. A fresh clone plus `pnpm run env:apply local` then
needs only the secrets, and `env:check` names exactly which.

The alternative, one mixed file per environment, means handing a new machine four
whole files most of whose contents were never confidential — which in practice
means pasting them into a chat, making them *less* private than committing.

## Why apply never deletes

ADR 0004 says the Catalog seed always wins: retired fixtures are deleted. That
precedent is deliberately **not** followed here.

The seed owns a table nothing else writes to, and a stale row is cosmetic. Env
destinations are shared with the platform and with whoever last fixed production
by hand, and a deletion on production is an outage. So `check` reports "present
at the destination, absent from the manifest" as a first-class finding, and
`--prune` is how you act on it after reading the list — gated behind a typed
confirmation on production.

`apply` also never writes an empty value. A value missing on this machine is
skipped and reported, which is what stops `apply production`, run from a laptop
that never held the production secrets, from blanking production.

## Consequences

`.env.local` and `.dev.vars` are generated, not hand-edited; `apply` refuses to
overwrite either if it did not write it, since a hand-maintained one may hold
values `env/` does not have yet. `.env.example` is generated too, and `env:check`
fails when it is stale.

Repo-scoped GitHub names carry a `PREVIEW_` prefix. This is a safety rule, not a
style: an environment secret shadows a repo secret of the same name, so identical
names would let a missing `production` value silently fall back to preview's.
ADR 0013 flagged that shadowing as a trap invisible in the file; different names
make it impossible rather than merely detectable.

Public values are GitHub **variables** and secrets are GitHub **secrets**. That
is what lets `check` value-diff the public half against the committed file —
the only diff a secret store can never support, since the API returns names
alone. For secrets, `check` proves presence and nothing more. It cannot catch
"the right name holding the wrong value", and no amount of work here would
change that.

`deploy.yml` runs `env:check <environment> --ci` before deploying, which is what
catches this ADR's predecessor's admitted hazard — "the staging deployment
inherits nothing" — before a merge ships a staging site nobody can sign into.
`--ci` resolves GitHub-delivered values from the job env because a workflow
cannot list its own secrets; Convex and the Worker are still checked for real.

Cloudflare is the one place the public/secret split does not reach: `vars` live
in committed wrangler config, which cannot express a per-PR Worker, so every
Worker value is set as a secret regardless.
