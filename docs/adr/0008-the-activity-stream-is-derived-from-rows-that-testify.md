# The activity stream is derived from rows that testify

Status: accepted (2026-08-03)

Home's stream is derived from the Group-scoped tables themselves rather than from
an events table. A Module joins the stream by carrying an actor and a time — not
by remembering to append an event. We have **deliberately not** chosen between
this and a real events log; this records the deferral and what would end it.

## Why deferred rather than decided

The original argument for deriving was partly built on a production history that
turned out not to exist: no data to backfill, and no household that had been
using the app for months and would find an events table empty on its first visit.
Both of those reasons are gone. What survives is the coupling cost — every
mutation carrying an emit obligation, where the one that forgets leaves a hole
nobody notices for months.

That alone did not feel like enough to commit either way, and it does not have to
be, because the two directions are not symmetric. Deriving now and building an
events table later is cheap: creations backfill perfectly from rows that already
carry `_creationTime` and attribution, so the only history lost is the edits and
deletions that are not recorded today anyway. The reverse is just deleting work.
And `activity.forGroup` already returns `GroupActivityEntry[]`, so either
implementation hands the same interface to the same component.

The deadline we thought we had is not one. A composer does **not** force an events
table: messages are content — rows with an author, a time and a body, exactly like
baby events — and join the stream as one more source.

## What the rule buys

Creations come free. A state transition costs the row the columns to testify with
— which is why `tasks` gains `completedAt` and `completedBy`, since "Bob took the
bins out" is the most wanted line on a household's shared surface and a plain
`done` boolean cannot say it. Edits and deletions are deliberately absent: a row
records its current state, not its history, and a household does not need to be
told that somebody changed an oven temperature.

It also settles which tables must carry Attribution, which `CONTEXT.md` defined
without saying who had to have it. **A table holding a Group's content records who
created the row**, required rather than optional — an optional ownership field is
a schema that has stopped saying who owns the row. `taskLists` and `babies` were
the only two out of line. `groups` and `memberships` are exempt: they are the
boundary itself rather than content within it.

## What would end the deferral

1. **You want an edit or a deletion in the stream.** That is the one thing
   deriving structurally cannot do, and wanting it once is the whole answer.
2. **A second state-transition column pair lands on the same table.** One is a
   design; two is a denormalised event log wearing a disguise.
3. **You want the stream to be authoritative** — "who deleted this, and when" as a
   question answerable under pressure. That is an audit requirement rather than a
   Home feature, and deriving can never serve it.

Chat is deliberately not on that list.

## Consequences

**Home is a summary, not an archive.** Every entry links to a Module that holds the
complete record, so being cut by the per-source quota is not losing information —
it is not being in the summary. That is why there is no "load more": a summary
with one invites the reader to treat it as the archive it is not. The quota stays
because it decides *what is in* the summary while time alone decides the order, so
a Group with a newborn and one recipe sees both.

This changes when chat arrives, because a message exists nowhere else and has no
Module page to fall back to. That is the same moment that reopens the question
above.
