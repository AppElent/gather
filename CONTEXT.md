# Gather

Gather is a household-management app. Everything a household keeps track of —
recipes, tasks, a baby's log, what's in the pantry — lives inside a Group that
its members share.

## Language

### Boundaries

**Group**:
The ownership boundary. Group content belongs to exactly one Group, and every
Member of that Group can see it; some content may later be marked **Public** so
authenticated Members of other Groups can read it too.
_Avoid_: Space, Organization, Team, Household, Workspace

**Group appearance**:
The visual identity a Group presents to its Members: an optional prepared
picture or a chosen icon, with a stable fallback when neither is set. It helps
a person recognize whether they are in their household, hockey club, or another
Group; the name and appearance they choose are important user-facing identity.
It does not change membership, privacy, permissions, or which Modules are
available.
_Avoid_: Group type, Group mode, Enabled features

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
Legacy short, readable identifier used by the old Group-addressed web URLs. It
is not part of the new ambient Group model and is not user-facing Group
identity. Group identity is the database identity; recognition comes from the
Group name and **Group appearance**.

**Current Group**:
The Group a person is currently using in the app. It is selected explicitly by
the person, retained by the client, and validated against their memberships;
it is not a hidden default that changes ownership or access. A person with no
Current Group is outside the Group-scoped product until they join or create a
Group.

### Scope

**Group-scoped**:
Content owned by a Group and visible to its Members — recipes, tasks, a baby's
log, integration connections.

**Personal**:
Legacy scope for records *about a person* rather than content they authored.
Personal records follow the person across every Group and belong to no Group;
Nutrition currently uses this scope. The target model removes this scope from
Gather, with Nutrition being deprecated separately. Pins are not Personal:
they are one person's, but are about a Group and are kept per Group (ADR-0005).

**Catalog**:
Reference data owned by nobody and readable by everybody — the foods that ship
with Gather, and the well-known cheeses (see **Tasting catalog**). Neither Group-scoped nor Personal. A Catalog entry has no author
and nobody may edit it; it changes only when a new version of Gather ships a
different one.
_Avoid_: Global data, Public data

**Finance record**:
Group content in Finances that Members edit in place — a House, a Mortgage
calculation, a Recurring cost, a Savings goal, an Investment holding. Every
figure in one was typed by a Member: Gather connects to no bank, imports no
file, and looks nothing up.
_Avoid_: Account, Statement, Ledger

**Finance calculator**:
A Group tool that estimates an outcome from values a Member enters and keeps
nothing unless asked. **Payment split** is the only one; everything else in
Finances is a Finance record.
_Avoid_: Ledger, Account statement

**Saved scenario**:
An immutable Group snapshot of the inputs and result of a **Payment split**.
Members change a scenario by duplicating it, so a comparison always retains the
assumptions it was made from. A Mortgage calculation is not a scenario: it is a
record, and duplicating one is how a Member asks what if.
_Avoid_: Editable draft, Live calculation

**House**:
A home a Group entered by hand — the one they live in, or one they are only
considering. Gather looks nothing up: there is no property register and no
automatic valuation, so a House is worth whatever a Member last said it was. It
is the container for what a home costs, holding one **Home-buying costs** and
one or more **Mortgage calculations**. Adding one asks for a name and nothing
else.
_Avoid_: Property, Address, Home (the word Home already names a Group's shared
surface)

**Mortgage calculation**:
A named estimate of what a House's mortgage costs, belonging to that House,
which a Group may have several of. It is a record Members edit in place rather
than a disposable result, and a Member asks what if by **duplicating** it. It is
not a loan account: Gather holds no balance a lender would recognise. Its
figures are the sum of its **Loan parts**, and because each part's fix ends on
its own date, its fixed-rate-expiry answer is a series of dated steps rather
than one figure.
_Avoid_: Mortgage account, Mortgage scenario

**Loan part**:
One piece of a Mortgage calculation, with its own amount, structure (annuity,
linear, or interest-only), interest rate, fixed-rate end date, and remaining
term. A mortgage is a combination of parts rather than one loan, so a part is
priced on its own and the calculation's totals are their sum. Extra repayments
and an optional Member-entered early-repayment charge belong to the part whose
interest they change.
_Avoid_: Tranche, Sub-loan, Line

**Recurring cost**:
A repeating financial commitment of a Group that a Member entered — rent,
utilities, insurance, a subscription. It carries an amount, how often it
repeats, a **category** from a fixed set, and a **split ratio**; together they
produce the Group's monthly and annual totals and each Member's share. It has
its own screen, which is where comparing what it could be bought for will
eventually live. It is not a one-off invoice, a reimbursement, a payment between
Members, a payment tracker, or a due-date reminder.
_Avoid_: Bill, Expense, Invoice, Reimbursement, Subscription ledger

**Split ratio**:
How a Recurring cost is divided between current Group Members, as shares that
total the whole. It says who bears what and nothing else: no debt accrues from
it and nothing is ever settled, which is what separates it from a **Payment
split**.
_Avoid_: Debt share, Owed amount

**Savings goal**:
A Group target with a desired amount, date, and manually entered saved amount.
It estimates the monthly amount required and the expected completion date; it
does not derive progress from transactions.
_Avoid_: Savings account, Budget envelope

**Home-buying costs**:
A Netherlands-specific estimate of the cash needed to buy a home and the
monthly mortgage payment that follows, belonging to one **House** — a purchase
not yet made is simply a House the Group does not own. Every rate and fee in it
is one a Member entered, and Gather never claims one is current. It does not
assess what a Group can afford or recommend a loan.
_Avoid_: Affordability assessment, Mortgage advice

**Net worth snapshot**:
A dated Group record of manually entered current asset and liability values,
plus three **derived** figures the Group has already modelled elsewhere: a
House's value, that House's mortgage balance, and the calculated current value
of the Portfolio overview. A Member saves a snapshot explicitly to compare over
time; a saved one freezes the derived figures too, including the moment the
prices came from, and is never edited afterwards. It is not a bank-connected
account view.
_Avoid_: Account aggregation, Financial statement

**Payment split**:
A Finance calculator's division of one event's costs among current Group
Members, equally or by custom amount. It may collect several payments that
different Members made, then shows who should contribute; it does not retain
debts, balances, or settlements.
_Avoid_: Bill, Expense claim, Settlement

**Portfolio overview**:
A Group-owned, information-only view of its listed-stock and ETF holdings. It
uses delayed or end-of-day market prices with their timestamp and never makes
investment recommendations or predictions.
_Avoid_: Brokerage, Investment adviser, Market research

**Investment holding**:
A Group's position in one listed stock or ETF. A Member may establish it from a
current quantity and average purchase price on a date, or from a history of
investment transactions; later transactions build on that dated opening
position. Its trading currency may differ from the Group's home currency.
_Avoid_: Account, Security

**Investment transaction**:
A recorded buy, sale, dividend, or fee used to establish an Investment
holding's position and informational performance. It is not required when a
Member starts from a current position, and it is never a tax record.
_Avoid_: Bank transaction, Tax record

**Average cost**:
The informational cost basis of an Investment holding: the total acquisition
cost divided across its current units. Gather uses it for realized and
unrealized performance, not tax reporting.
_Avoid_: FIFO, Tax basis

**Manual adjustment**:
A Member-entered correction to an Investment holding for a stock split, merger,
or ETF change. It is used instead of silently applying a provider's corporate
action.
_Avoid_: Automatic corporate action

**Stale valuation**:
A Portfolio overview value based on the last known price or exchange rate after
fresh data could not be retrieved. Its timestamp and age remain visible.
_Avoid_: Current price, Missing value

**Group home currency**:
The currency a Group selects for combined money totals. A Portfolio overview
preserves each holding's trading currency and translates the total using an
exchange rate whose timestamp is shown.
_Avoid_: Base currency, Default currency

A food *a person added themselves* is not Catalog. It sits alongside the
Catalog and looks the same when you search, but it has Attribution and its
creator can change it.

### Content

**Module**:
A feature area — Recipes, Tasks, Baby log, Nutrition. Every live Module is
available in every Group; a Group never enables or disables one. A Module with
nothing in it is not *off* — it is **empty**, and an empty Module invites you to
make its first thing rather than offering a switch (ADR-0022).
_Avoid_: Feature, App, Section, Widget

**Group search**:
One place to find selected kinds of records across the Group a Member is
currently in. It is not a collection filter and never reaches into another
Group.
_Avoid_: Global search, Universal search, Module search

**Recent records**:
A Member's personal, Group-specific record of searchable things they opened.
It is persisted only on their device, helps them return to a record, and is not
shared activity or a Group history.
_Avoid_: Search history, Recent activity

**Grocery list**:
The zero-or-one ordinary Task list a Group selects as the list it uses while
shopping. It may be local or externally sourced and retains that list's available
capabilities; the selection gives it a purpose without creating a second
checklist model.
_Avoid_: Grocery item list, Shopping-list module

**Meal library**:
A Group-owned, editable collection of dinners from which its Meal planner
chooses. A library meal may be a quick name rather than a Recipe; Recipes are
also direct candidates for planning and are not duplicated as library meals.
_Avoid_: Meal catalog, Recipe catalog

**Quick dinner**:
A planned dinner day with a maximum preparation time of 10, 20, or 30 minutes.
Random planning considers only candidates with a recorded time no greater than
that maximum; an ordinary dinner day may use any candidate.
_Avoid_: Easy dinner, Fast meal

**Planned dinner**:
The one dinner a Group has assigned to one date in a Monday–Sunday planner week.
It refers directly to any Recipe visible in the Group or carries a free-text
meal; when a referenced Recipe disappears, its last known title and time remain
as the dinner's snapshot.
_Avoid_: Meal slot, Recipe copy

**Pantry entry**:
A Group's record that an item is in stock at home, with an optional quantity and
free-text quantity/value. Its name is free text; it is an inventory reminder,
not a purchase history or a food diary entry.
_Avoid_: Stock movement, Inventory transaction

**Calendar**:
A named, Group-scoped collection of events. A Group may have none, one, or many;
a member chooses which calendars are shown in the Calendar Module.
_Avoid_: The calendar, Schedule (when referring to the collection)

**Calendar event**:
A manually created, Group-scoped event in a Calendar, with a title, calendar day,
and either no time or a start-and-end time range. It is neither a recurring
appointment nor an event mirrored from another calendar in v1; a timed range
ends later on the same calendar day. Its date and times are the household's local
calendar values, not timezone-converted instants.
_Avoid_: Synced event, Recurring event

**Calendar visibility**:
One Member's choice of which shared Calendars to show in one Group. It changes
only that Member's view; it never changes a Calendar or its events.
_Avoid_: Hide calendar (when it suggests a shared change)

**Pin**:
One person's choice to keep a Module in their own sidebar **in one Group**. A
Pin is always one person's — never a Group's, and never visible to the rest of
it — but it is kept per Group, because what you reach for first in a wine club
is not what you reach for first at home (ADR-0005). Pinning never enables a
Module: every Module is available in every Group either way.

The web keeps a Member's Pins on their membership row; the phone keeps its own
list on the handset, and the two do not sync (ADR-0033).
_Avoid_: Favourite, Shortcut, Bookmark, Enabled module

**Hidden Module**:
One person's choice to keep a Module off their own All screen, on one phone, in
one Group. Nobody else sees it, and it does not travel to their other devices
(ADR-0033). Hiding is a display choice and nothing more: a hidden Module is
still available, still reachable from Search, from Home and from every deep
link, and it is still listed under Hidden at the bottom of the screen that hid
it. It is never a switch that turns a Module off, because there is no such
switch (ADR-0022). Hiding a Module also takes it off the top, since a shortcut
to something deliberately out of sight is a contradiction.
_Avoid_: Disabled, Removed, Turned off, Archived, Deactivated

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

**Public**:
A visibility choice for Group-scoped content that makes it readable from other
Groups. Public means readable by authenticated Gather users, not by signed-out
visitors. Public content remains owned by its home Group; public visibility does
not grant other Groups the right to edit or delete it.
_Avoid_: Shared into, Cross-posted

**Private**:
A visibility choice for Group-scoped content that limits it to Members of its
home Group. Privacy comes from the Group boundary rather than from a personal
owner or private flag on an individual person.

**Share**:
Legacy term for making Group-scoped content visible to an additional Group.
Gather is retiring this Group-to-Group visibility model in favor of **Public**
and **Private**. (**Copy** is a different verb — see below — and not a synonym
for this one.)

**Move**:
Changing which Group a piece of content lives in.

**Copy**:
Making an independent recipe out of one you can see, in a Group of your own. The
copy has its own life: the original may change or be deleted and the copy will
not notice. Recipes only — a recipe you cooked and changed *is* a different
recipe, and no other Module is like that, so Copy is not a verb of the boundary
the way Share and Move are (ADR-0007).
_Avoid_: Clone, Duplicate, Fork

**Import**:
Making a recipe out of a page on the web. What arrives is a **reading** of that
page — partly parsed from structured data the page published, partly guessed by
a model from its prose — so it is never a recipe until a person has looked at
it and saved it. That review is the point of the verb and not a step in front
of it: an import nobody confirmed is not something the Group has. Recipes only,
today.
_Avoid_: Scrape, Sync, Fetch. (**Copy** is a different verb — that one starts
from a recipe already in Gather.)

**Drop**:
What another app hands to Gather through the phone's share sheet — a link, some
text, a photo — before it is anything in Gather. A Drop has no Group and no
Module until a person names them, and an abandoned Drop leaves nothing behind.
It is one payload at a time, not a queue: a second Drop replaces the first
(ADR-0028).
_Avoid_: Share (that word already means making Group content visible to a
second Group), Import (a Drop aimed at Recipes *becomes* one), Attachment.

**Drop target**:
A destination a Drop can be aimed at — a new recipe, a note, a line on the
grocery list, a photo on a tasting subject. A target either **creates** a thing
from the Drop or **appends** it to one that exists, and the appending ones ask
which. Every Module declares its targets, including the ones that declare none.
_Avoid_: Handler, Receiver, Intent

**Provenance**:
A reference back to what something was created from — a diary entry recording
which recipe it came from, a copied recipe recording the one it was taken from,
an imported recipe recording the address it was read off. Provenance never
grants access: it is checked on read, and it may point at something the reader
can no longer see.

It may also point **outside Gather**, at a page nobody here controls, which may
change under it or stop existing. That is not a weaker kind of provenance and
does not need repairing: it records where this came from, which stays true
whatever happens to the page.
_Avoid_: Link, Source

**Prepare**:
What happens to a photo between being chosen and being stored — the person frames
it, Gather shrinks it. What Gather keeps is the prepared photo; the file that was
chosen is never stored (ADR-0010). What preparing does depends on where the photo
will be shown.
_Avoid_: Resize, Compress, Optimise, Process

**Combo** (Dutch: *Combinatie*):
A named, reusable set of things you log together — the same lunch, again. It is
**Personal**: it belongs to a person, follows them into every Group, belongs to
none, and no other Member sees it. Made by *choosing entries from a meal you
have already filled in*, never by opening a builder; saving replaces the
entries it was made from with the Combo's own log and leaves the rest of the
meal alone, and logging one afterwards never edits it (ADR-0012). An entry a
Combo wrote is badged with its name — snapshotted, the way a Personal record
snapshots everything it references, so renaming the Combo does not rewrite the
day it was logged on. A Combo may contain a Recipe; it is not a kind of Recipe,
and a Recipe is not a kind of Combo — they sit on opposite sides of the
Group/Personal boundary.
_Avoid_: **Food group** — an established nutrition term (grains, dairy,
protein) that would actively mislead here. **Meal** — that word already names
the breakfast/lunch/dinner/snack slot throughout the schema, and taking it would
force a rename with nothing gained. Also avoid: Preset, Bundle, Template.

**Child**:
The person a Baby log is kept for. One Child belongs to one Group, and every
Member of that Group reads and writes the same log. The word a person reads is
always *child*; **Baby log** names the Module, and `babies` is only what the
table is called.
_Avoid_: Baby (for the person), Kid, Infant

**Tracked types**:
The event types a Child's log **offers** — which quick-log buttons exist and
what the event-type picker contains. Chosen per Child, because a newborn and a
three-year-old do not keep the same log. Turning one off shrinks what you are
offered and nothing else: entries already logged stay, stay visible and stay
editable, so this is never a filter on the log and never a way to delete
(ADR-0022).

A Child tracks every type **except** the ones somebody has turned off, and the
record stores those refusals rather than the acceptances. A type nobody has
refused is offered — which is what lets a type added to the catalogue reach
households that made their choice before it existed.
_Avoid_: Enabled types, Active types, Visible types

**Tasting**:
One person's record of having tasted something on a day — a score out of five,
what they tasted in it, and their notes. Group-scoped and carrying
**Attribution**, so two Members of a wine club each keep their own Tasting of
the same bottle rather than overwriting one figure. It is the thing a person
*makes*: a Tasting subject comes into being because somebody logged a Tasting
against it, never as a separate first step (ADR-0024). It carries the day it
happened, which is not the day it was written down.
_Avoid_: Rating, Review, Note, Entry (the Baby log and the food diary already
have entries)

**Tasting subject**:
The thing tasted — a cheese, a wine, a beer. Group-scoped, and the thing the
household accumulates a relationship with: the photo of the label, the note that
you buy the aged one, every Tasting anybody has made of it. It holds the facts
that do not change between tastings (producer, vintage, milk type); what you
thought on the night belongs to the Tasting.

The shared word appears only where the Kind genuinely is not known. A person
never reads "subject" or "item" — they read *cheese*, *wine*, *beer*.
_Avoid_: Item, Product, Bottle (per-Kind words for the shared concept), Entry

**Kind**:
Which of cheese, wine or beer a Tasting subject is. A Kind is *data*, not code:
it declares the fields its subjects and their Tastings have, the vocabularies
those fields draw on, and whether a Tasting catalog ships for it. Adding a
fourth Kind is an entry in that table plus its messages — not a new Module
backend. The Kind is fixed by the address a page is at, so the Wines Module can
never show a cheese.
_Avoid_: Type, Category, Class

**Tasting catalog**:
The list of well-known subjects Gather ships for a Kind — the cheeses everybody
has heard of. Catalog in the established sense: owned by nobody, read-only,
reconciled by `seedKey`, present in every environment. A Kind may have none, and
wine and beer deliberately have none: the set of wines is unbounded and every
vintage differs.

It is a **picker and not a store**. Nothing in a Group ever points at a catalog
row: choosing one creates that Group's own Tasting subject, prefilled from it,
which is thereafter ordinary Group content — editable, photographable, and the
only thing every list and query sees (ADR-0024).

Distinct from a Kind's **vocabularies** — the grape varieties, regions, styles
and aroma descriptors its fields offer. Those ship too, but they are field
options rather than subjects, and every Kind has them even when it has no
catalog.
_Avoid_: Presets, Templates, Library

**Sample household**:
A complete, fake Group — members, recipes, tasks, a baby's log, a food diary —
that exists so a test or preview environment can be looked at. Never present in
production. Not Catalog: the Catalog is real data everyone gets, the Sample
household is pretend data nobody outside testing ever sees.
_Avoid_: Demo data, Dummy data, Test data, Seed data

### Runtime states

**Connected-only**:
Gather mobile v1's network posture. A live connection is required for service
data and service actions; it promises neither cached content nor offline writes.

**Unavailable**:
The state in which Gather cannot reach the service it needs while a person's
identity is still unresolved or retained. It is distinct from being signed out:
an unavailable person is not sent to the welcome screen merely because a
connection or refresh failed.
_Avoid_: Signed out, Offline mode

## Standing rules

- A Personal record **snapshots** what it references. Provenance is
  permission-checked on read and safe to dangle. A **Combo** is the deliberate
  exception and says why: it is a shortcut for what will happen rather than a
  record of what did, so it holds references and reads their current figures
  (ADR-0012).
- Group-scoped content is either **Private** to its home Group or **Public** to
  other Groups. Privacy comes from Group membership; a person does not own a
  private subset inside a Group.
- The Catalog is read-only and always reflects the shipped version. A person
  who needs a different entry creates their own alongside it.
- The Current Group is selected by the person and validated against their
  memberships. Web and mobile use the same ambient selection model; no hidden
  default determines ownership or access.
- Whether you may change something follows its home Group from anywhere. The
  current Group is the destination for ordinary writes, and authorization still
  checks that the person is a Member of it.
- A photo a person chooses is stored as prepared and never as chosen, so one
  that cannot be prepared is not stored at all. An image Gather fetches for
  itself is neither chosen nor prepared (ADR-0010).
- A stored file lives exactly as long as some row points at it. The mutation
  that replaces, clears or deletes the last pointer deletes the file with it, so
  a photo nobody can reach is not a thing storage holds — and a photo two rows
  hold survives the first of them going. A file uploaded before any row
  references it is the exception, and is not yet handled.
- A refusal inside a Group never says which refusal it is. "No such record" and
  "not in this Group" are one answer; refusing the Group itself is a separate,
  distinct one.
- A page below a Module's index carries its own trail, and its way back is the
  parent's **address** rather than the browser's history — the same answer
  however somebody arrived, and the Group travels with it (ADR-0013).
- A Module is configured by its content and never by a switch. Nothing turns a
  Module on, and what a Module needs configured belongs to one of its records —
  so an empty Module's invitation and its setup are the same screen (ADR-0022).
- Every figure in Finances is one a Member typed, and what a home costs hangs
  off a **House**: its buying costs, and its mortgage calculations, which are
  made of **Loan parts** rather than of one loan. A Member asks what if by
  duplicating a calculation rather than editing one, and a **Payment split** is
  the only result Gather throws away (ADR-0025).
- A Catalog entry is a fact or a suggestion, and which one decides whether
  anything may point at it. A Food is a fact, so a diary entry references the
  Catalog row and the row stays read-only forever. A **Tasting catalog** entry
  is a suggestion, so nothing references it: tasting it makes a copy that is
  yours, and the shipped row is never seen again (ADR-0024).
- Every client names things the same way and looks however suits it. The words a
  person reads — a Group, a Pin, a Module and what it is for — are one answer
  wherever they are read; the palette, the type and the layout are each client's
  own. So "which one am I using?" is answered by what is on screen, and "what is
  this called?" never is (ADR-0017).
