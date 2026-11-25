# Create or link a list from an external source — final (APP-863)

New list asks where the list lives (Gather, Todoist or Notion). Linking an
existing Todoist project or Notion database is a separate path in the same
dialog. Connecting a provider happens inside the flow and comes back to the
same step, and linking ends inside the loaded list.

**Canvas:** https://claude.ai/artifact/SBLnxdBz5WDKEMLMxPQ9ex ("Gather — Tasks"),
page `Externe bronnen: lijst maken of koppelen`. The not-chosen option B (a
choose-first dialog with three paths) stays there.
**Approved:** option **A, source in New list plus Link an existing list**, by
Eric, 25 November 2026 (decision card).
**Final source:** `external-sources_final/`. `Ext.dc.html` is the web part
(props `screen` new|newTodoist|pick|connect|look|lookNotion|after, `theme`;
its `choose` screen is option B and is not built). The `ES-*` files are the
approved artboards. They are a visual reference: build from this file and the
web's tokens and components (`DESIGN_SYSTEM.md`), not from their markup.

**Platform:** web. Connecting and linking stay on the web, where a Group is
managed (ADR-0042). The phone only starts drawing a linked list's own colour
and icon (they are stored already).

**Data model:** no change. `taskLists.create` already takes `kind`, `icon` and
`color` for external lists. No table, field, index or migration.

## Today, and what changes

| Today | Final |
| --- | --- |
| New list has a link at the bottom that swaps the dialog for a bare choice ("Eerst Notion koppelen…", "Todoist — staat daar…") | New list asks **Waar staat de lijst?**; **Bestaande lijst koppelen…** is its own path |
| Connect sends you through OAuth and back to Tasks with the dialog closed | You come back to the same dialog step |
| A linked list gets no colour or icon (grey tile) | You pick name, colour and icon before linking |
| Notion asks for every property by hand | Gather guesses the fields; **Velden aanpassen…** opens today's mapping |
| Linking closes the dialog on the index; the list loads only when opened | **Koppelen en openen** lands in the loaded list, with a one-time banner |

## 1. New list (A1, A2, A8 dark)

The existing New list dialog (`NewListDialog`) gains, above the name, a
segmented control **Waar staat de lijst?** / **Where does the list live?**,
a radio group of three:

- **Gather** — "alleen hier" / "only here". Default. The dialog is today's:
  name, kind, colour and icon, **Maak** / **Create**. Note under the control:
  "Alleen in Gather, voor iedereen in de Groep." / "Only in Gather, for everyone
  in the Group."
- **Todoist** — sub-line the connection's account name ("account Eric"). The
  kind list is hidden (kinds with own behaviour are Gather-only); name, colour
  and icon stay. Note: "Gather maakt een nieuw Todoist-project met deze naam. Je
  bewerkt het hier en in Todoist." / "Gather creates a new Todoist project with
  this name. You edit it here and in Todoist." The primary button reads **Maak in
  Todoist** / **Create in Todoist**. It creates the Todoist project, then the
  linked list on it with the chosen colour and icon, then opens the list (§4).
  With no Todoist connection the segment's sub-line reads "verbinden" /
  "connect" and choosing it starts the connect step of §3 for Todoist.
  With several Todoist connections in the Group, the sub-line becomes a select
  of connections.
- **Notion** — sub-line "alleen koppelen" / "link only". Gather only reads
  Notion (ADR-0021), so choosing it opens **Bestaande lijst koppelen** on the
  Notion tab.

At the bottom left, before Annuleren and Maak: **Bestaande lijst koppelen…** /
**Link an existing list…**, which opens §2.

A failure to create the Todoist project shows under the form, as today's create
failure does, and creates nothing in Gather.

## 2. Link an existing list (A3)

The same dialog, titled **Bestaande lijst koppelen** / **Link an existing
list**, with a back button to New list.

- Tabs (two segments): **Todoist** and **Notion**, each with a sub-line:
  "verbonden · {account}" / "connected · {account}" or "nog niet verbonden" /
  "not connected yet".
- A search field ("Zoek een project" / "Zoek een database"), filtering the
  rows by name.
- Rows: each project or database with its open count ("12 open") for Todoist
  and its type and count for Notion. A source already linked in this Group is
  greyed, not selectable, with "al gekoppeld" / "already linked".
- Footnote, Todoist: "Een project dat al gekoppeld is, staat grijs. Je kiest er
  daarna een naam, kleur en icoon voor." Notion: "Notion-lijsten zijn in Gather
  alleen te lezen. Zie je een database niet? Geef Gather er toegang toe in
  Notion."
- Empty result keeps today's "Niets gevonden…" messages.

Choosing a row opens §4.

## 3. Not connected (A5)

On a tab whose provider is not connected: a panel "{Provider} is nog niet
verbonden" with one line on what happens and a primary **{Provider}
verbinden** / **Connect {provider}**. It starts the existing connect
(`useConnectProvider`) with a `returnTo` that brings the person back to this
dialog on this tab (for example `tasks?add=link&provider=notion`). Tasks reads
that on load and reopens the dialog there. Only the return address changes; the
OAuth exchange itself is not touched (APP-855).

## 4. Name, colour and icon (A4, A6)

Titled **Zo staat hij in Gather** / **How it shows in Gather**, back button to
§2.

- A source line with a link glyph: "Todoist · Eric › Verbouwing" /
  "Notion · Huis › Klussen huis".
- The tile preview and a name field, prefilled with the source's name.
- Colour swatches and icon choices, as in New list. Default colour: the first
  that no other list in the Group uses, else the first.
- **Notion only:** **Velden (zelf herkend)** / **Fields (detected)**: Titel,
  Gedaan, Datum, Prioriteit, Labels, each with the property Gather picked, or
  "niet gevonden" / "not found" in muted. Guessing: the title property; a
  status property, else the first checkbox, for done; the first date; a select
  whose options look like 1–4 or P1–P4 for priority; the first multi-select for
  labels. **Velden aanpassen…** / **Adjust fields…** opens today's mapping form
  with these preselected. Link is disabled until title and done are set.
- Note, Todoist: "Taken die je hier toevoegt, wijzigt of afvinkt, staan meteen
  in Todoist. Naam, kleur en icoon gelden alleen in Gather." Notion: "Alleen
  lezen: afvinken en wijzigen doe je in Notion. Naam, kleur en icoon gelden
  alleen in Gather."
- Buttons: **Terug** / **Back** and **Koppelen en openen** / **Link and open**.

## 5. After linking or creating (A7)

The dialog closes and the browser goes to the new list's page, which loads the
source right away (the first fetch, as on first open). Above the tasks a
one-time banner (`role="status"`):

- Todoist: "Gekoppeld aan Todoist" / "Linked to Todoist", "Wat je hier toevoegt,
  wijzigt of afvinkt, staat meteen in Todoist. Wat in Todoist verandert, zie je
  na Vernieuwen."
- Notion: "Gekoppeld aan Notion", "Alleen lezen. Wat in Notion verandert, zie je
  na Vernieuwen."

**Begrepen** / **Got it** hides it for good for that list on that browser.
The header's subtitle names the source and account: "Todoist · account Eric ·
4 open".

A local list made through **Maak** keeps today's behaviour (opens the list).

## Build notes

- Todoist adapter: create a project (`POST /projects` with `name`) on the
  connection, within the existing `data:read_write` scope, so nobody
  reconnects. An action creates it and returns its id; then
  `taskLists.create` links it.
- ADR-0021 says "The first slice links existing provider sources rather than
  creating them": amend it to allow creating a Todoist project from New list.
- `listSources` returns the open count per source where the provider gives it
  cheaply; leave it out otherwise rather than adding calls per source.
  Already-linked sources come from the Group's lists with the same
  `connectionId` and `sourceId`.
- Notion field guessing lives next to `getSourceSchema` and is unit tested.
- Phone: `TaskListsScreen` and the list header draw a linked list's stored
  colour and icon instead of the grey tile, keeping the link glyph.
- Messages in `nl` and `en` through the catalogue; the old `addList.mirror`,
  `addList.linked` and `addList.connectFirst` strings go.
- Tests: create in Todoist (success, project failure creates nothing), link
  Todoist and Notion, already-linked disabled, the return-to-step after connect,
  landing in the list, banner dismissal, Notion guesses.
