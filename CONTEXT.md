# Gather

Gather is a household-management app. Everything a household keeps track of —
recipes, tasks, a baby's log, what's in the pantry — lives inside a Group that
its members share.

## Language

### Boundaries

**Group**:
The sharing boundary. Shared content belongs to exactly one Group, and every
Member of that Group can see it.
_Avoid_: Space, Organization, Team, Household, Workspace

**Personal group**:
A Group with a single Member, created for every person when they sign up. Where
private content lives. An ordinary Group in every respect — it simply has one
Member.
_Avoid_: Private space, Personal workspace, Inbox

**Member**:
A person within a Group. Any Member may let somebody in; **admins** may
additionally rename the Group, delete it, change roles, and put somebody out
(ADR-0006).
_Avoid_: Owner, Participant. (A *user* is a person; a Member is a person
*within* a Group.)

**Invite code**:
The code that admits somebody to a Group. Any Member may read it and pass it on
— inviting a housemate is not an administrative act. It is a capability rather
than a property of the Group: it is asked for by name, and it changes whenever
somebody is removed, because a code that outlives a removal undoes it.
_Avoid_: Invite link, Token, Join key

**Slug**:
The short, readable, globally unique name identifying a Group in a URL. Readable
by design: it is how someone notices which Group they are acting in.

### Scope

**Group-scoped**:
Content owned by a Group and visible to its Members — recipes, tasks, a baby's
log, integration connections.

**Personal**:
Records *about a person* rather than content they authored — their food diary,
their nutrition targets. These follow the person across every Group and belong
to no Group. Pins were listed here and are not any more: they are one person's,
but they are *about* a Group and are kept per Group (ADR-0005).

**Catalog**:
Reference data owned by nobody and readable by everybody — the foods that ship
with Gather. Neither Group-scoped nor Personal. A Catalog entry has no author
and nobody may edit it; it changes only when a new version of Gather ships a
different one.
_Avoid_: Global data, Public data

A food *a person added themselves* is not Catalog. It sits alongside the
Catalog and looks the same when you search, but it has Attribution and its
creator can change it.

### Content

**Module**:
A feature area — Recipes, Tasks, Baby log, Nutrition. Every live Module is
available in every Group; a Group never enables or disables one.
_Avoid_: Feature, App, Section, Widget

**Pin**:
One person's choice to keep a Module in their own sidebar **in one Group**. A
Pin is always one person's — never a Group's, and never visible to the rest of
it — but it is kept per Group, because what you reach for first in a wine club
is not what you reach for first at home (ADR-0005). Pinning never enables a
Module: every Module is available in every Group either way.
_Avoid_: Favourite, Shortcut, Bookmark, Enabled module

**Home**:
A Group's shared surface — what a Member sees on opening it. It carries a
summary of the Group's recent activity, and is where conversation will live. A
summary and not an archive: every entry links to the Module that holds the whole
record, which is why there is nothing older to page back to (ADR-0008).
_Avoid_: Dashboard, Command center

**Attribution**:
The person who created a piece of Group-scoped content. Attribution records
*who*; it never confers ownership or access. Every table holding a Group's
content carries it (ADR-0008).
_Avoid_: Owner, Author

**Share**:
Making Group-scoped content visible to an additional Group without changing
where it lives. The Group it is shared into may read it and no more: writing
follows the home Group.
_Avoid_: Publish, Cross-post. (**Copy** is a different verb — see below — and
not a synonym for this one.)

**Move**:
Changing which Group a piece of content lives in.

**Copy**:
Making an independent recipe out of one you can see, in a Group of your own. The
copy has its own life: the original may change or be deleted and the copy will
not notice. Recipes only — a recipe you cooked and changed *is* a different
recipe, and no other Module is like that, so Copy is not a verb of the boundary
the way Share and Move are (ADR-0007).
_Avoid_: Clone, Duplicate, Fork

**Provenance**:
A reference back to the content something was created from — a diary entry
recording which recipe it came from, a copied recipe recording the one it was
taken from. Provenance never grants access: it is checked on read, and it may
point at something the reader can no longer see.
_Avoid_: Link, Source

**Prepare**:
What happens to a photo between being chosen and being stored — the person frames
it, Gather shrinks it. What Gather keeps is the prepared photo; the file that was
chosen is never stored (ADR-0010). What preparing does depends on where the photo
will be shown.
_Avoid_: Resize, Compress, Optimise, Process

**Sample household**:
A complete, fake Group — members, recipes, tasks, a baby's log, a food diary —
that exists so a test or preview environment can be looked at. Never present in
production. Not Catalog: the Catalog is real data everyone gets, the Sample
household is pretend data nobody outside testing ever sees.
_Avoid_: Demo data, Dummy data, Test data, Seed data

## Standing rules

- A Personal record **snapshots** what it references. Provenance is
  permission-checked on read and safe to dangle.
- Content in a Group is visible to that Group. Privacy comes from *which Group*
  something lives in, never from a flag on the content.
- The Catalog is read-only and always reflects the shipped version. A person
  who needs a different entry creates their own alongside it.
- The Group you are in is in the URL. Nothing stores which one you are in, and
  nothing falls back to a Group you happen to belong to.
- Whether you may change something follows its home Group from anywhere. *Where*
  you change it is the address: a write happens where the URL names the Group
  that is about to change.
- A photo is stored as prepared and never as chosen. Preparing is the only way
  in, so a photo that cannot be prepared is not stored at all.
- A refusal inside a Group never says which refusal it is. "No such record" and
  "not in this Group" are one answer; refusing the Group itself is a separate,
  distinct one.
