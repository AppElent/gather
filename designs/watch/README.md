# Apple Watch — design study (APP-646)

Gather on the Apple Watch: a native SwiftUI companion app for a Member on the
go, hands full. MVP modules are Groceries, Today and Loyalty cards, on a
modular base so more modules can be added later. Managing stays on the phone
and the web. Look: Gather Design System, dark on black like watchOS; colour
only on tiles and check rings, numerals in ink.

**Canvas:** https://claude.ai/artifact/MjFuidkhjo48VAZnMdWVfn ("Gather — Apple Watch").
**Approved:** all pages, by Eric, 25 November 2026 (decision card,
"Goedkeuren"), with direction **A, a module start list**, chosen on
24 November. B (vertical pages, one per module) stays in `Main.dc.html` as
the round's record.

## Files

| File | Artboard | Issue |
| --- | --- | --- |
| `Main.dc.html` | Direction A (chosen) vs B (not chosen) | APP-654 |
| `Shell.dc.html` | Start list, not paired, pairing, key revoked, offline, error | APP-654 |
| `Groceries.dc.html` | List (interactive), dictation, recognised item, offline in the store, empty | APP-655 |
| `Today.dc.html` | Today list, task detail with Done, empty | APP-656 |
| `Cards.dc.html` | Card list, linear barcode, matrix code (QR and others), number only, empty | APP-657 |
| `Phone.dc.html` | iPhone Settings › Apple Watch: paired, not paired, dark | APP-658 |
| `canvas.json` | Canvas index (pages, boards, notes) | |

## The decision

- The watch opens on a **start list**: the Group's name in the title bar, then
  one row per module with a tile and a one-line summary ("7 open",
  "2 afspraken · 3 taken", "5 kaarten"). Rows follow the module order on the
  phone. A new module is a new row; nothing else in the shell changes.
- Every module screen has a back title ("‹ Boodschappen") to the start list.
- On return the watch reopens on the last used module.

## Behaviour

- **Pairing** is automatic: the iPhone hands over a watch device key
  (APP-653, APP-658). Without it the watch says "Open Gather op je iPhone";
  there is no input on the watch. A revoked key wipes the local copy.
- **Offline:** each module shows its last copy; changes wait in an outbox and
  a footer line says "Offline · N wijzigingen wachten". The error screen
  appears only when there is no copy at all.
- **Groceries:** a tap checks an item off with a wrist tap and moves it to
  "In je mandje"; a tap there puts it back. Adding uses system input
  (dictation, Scribble, keyboard) and the phone's recognition, without a
  confirm button.
- **Today:** appointments by time, then tasks (overdue as a word, in danger
  text), then today's meals. A task opens a detail with one large "Klaar"
  button; a repeating task moves on per the phone's rules. Empty shows the
  first appointment of tomorrow.
- **Loyalty cards:** Group order (APP-440), catalogue logo, no photos. The
  code is drawn on white with whole-pixel bars and a quiet zone, encoded on
  the server (watchOS has no Core Image). Matrix formats share one screen.
  When the server cannot encode, or the format fails the till test, the card
  shows its number only. Always-on does not dim while a card is open.
- **iPhone, Settings › Apple Watch:** pick the Group and grocery list with a
  native list; "Ontkoppelen" asks for a system confirmation. Shown as not
  paired when the watch app is not installed.

Touch targets are at least 44 pt. Copy on the artboards is Dutch; the build
adds the English strings through the message catalogues.
