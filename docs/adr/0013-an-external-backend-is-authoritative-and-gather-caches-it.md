# An external Backend is authoritative, and gather only caches it

Status: accepted (2026-08-10)

A Module's collection has exactly one **Backend**. `local` is one of them —
named, not implied — and an external provider is another. When the Backend is
external, **the provider owns the records** and gather keeps a cache so that the
Group can read them, search them and see them beside its local ones.

The Tasks Module is the first to have this, with Todoist as the first writable
provider. Notes and Calendar are expected to reuse the contract; their record
shapes and adapters are not in it.

> Recorded here because the spec (#103) and the parent architecture issue (#34)
> refer to "ADR-0014 and ADR-0015" for these decisions and no such files
> existed. The numbering follows this directory's actual sequence; this file is
> the authority decision and [0014](0014-a-provider-declares-what-it-can-do-and-gather-never-pretends.md)
> is the capability one.

## The rules that follow from "the provider owns it"

**A write goes to the provider first.** The cache is updated after the provider
acknowledges it, never before and never instead. An unacknowledged write is not
data: it is a failed attempt, and it is reported as one.

**The provider wins.** Every conflict, every difference at refresh, every
deletion. A cached row that the provider no longer has stops existing here too.
There is no merge step and no "local changes" to protect, because a local change
that the provider did not accept was never made.

**The cache is never promoted.** A stale cache does not become the source of
truth because the provider is unreachable. It becomes explicitly stale and
read-only, which is a different offer: *this is what we last saw*, rather than
*this is what is true*.

**A remote success with a failed cache write is still a success.** The provider
took it; only our copy is behind. That is shown as saved remotely and pending
reconciliation — the one state where the cache is knowingly wrong and says so —
rather than as an error the reader would undo by trying again.

## Why the cache exists at all

Reading through to the provider on every render was the earlier shape, and it
made the Module unusable as a Group surface: a request per open, no way to show
external and local lists in one place, and nothing at all to show when the
provider was down. A cache also gives Group-scoped access its object — a Member
reads rows in this database, checked against the Group in the URL, rather than
the app fanning out somebody's token per reader.

## Why refresh is manual

Fetching happens when a list is first opened and when a Member asks. No polling,
no webhooks, no schedule. Provider requests are rate-limited and paid for in
somebody's quota, and a household that has not opened Tasks today does not need
gather spending them. Manual refresh also makes the freshness of what is on
screen something the reader chose, rather than something they have to guess at.

The cost is honest and stated: gather is behind until you ask. That is the
correct trade for a mirror of somebody else's system, and it is reversible —
adding a schedule later changes when `refresh` is called and nothing else.

## Why a connection belongs to the Group

Credentials sit server-side and are scoped to the Group that authorised them. A
Group may hold several connections per provider — a shared household Todoist and
somebody's own — and one connection may back several lists. Every Member of the
Group uses the Group's connection, limited by what the provider itself granted.

This is [ADR-0003](0003-three-scopes-personal-group-and-personal-records.md)
applied to a token: an integration that answered from whoever happened to be
reading would show different tasks to different Members of the same household,
which is not a shared surface at all.

## What is deliberately not decided here

Migrating a list between Backends, creating remote projects or databases from
gather, an offline write queue, and any Notes or Calendar adapter. Each is a
separate decision, and none of them is made easier by guessing at it now.
