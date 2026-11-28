# Shared costs: pots, settle up, receipts, standing costs in a pot: final (APP-324, 325, 326, 327)

Eric approved this on a decision card on 27 Nov 2026 ("Goed, bouwen"). The one-off calculator stays as "Eenmalig verdelen" under the pots.

- **Canvas:** https://claude.ai/artifact/NPD3Zz5t2aVDXXrJQ9zivi, pages `APP-324` to `APP-327` and `Geld · datamodel`.
- **Source:** [`shared-costs_final/`](shared-costs_final/).
  - Phone artboards import `Money.dc.html`. Its `screen` prop takes `pots`, `pot`, `expense`, `expenseExact`, `history`, `settle`, `settled`, `zero`, `payLink`, `receipt`, `receiptRead`, `recurring` or `auto`. It also takes `theme` (light | dark) and `lang` (nl | en).
  - Web artboards import `MoneyWeb.dc.html`, with `screen` set to `pot` or `settle`.
  - `Main.dc.html` is the pots list.
- **Data model:** [APP-324-327-data-model.md](APP-324-327-data-model.md).
- **Blocked by:** the ADR in APP-294, which supersedes ADR-0025 ("Shared costs is only a calculator").

The example pot works out as the build must. The part computes it with the same rules:
- Rounding cents go to the payer.
- Balance is paid minus share.
- Settle up uses the fewest transfers.

## APP-324: pots, expenses, balances

| Artboard | What it shows |
| --- | --- |
| `Main` | "Kosten delen" opens on pots, open ones first and then closed ones, each with your balance (+ owed to you, − you owe). Under them: "Eenmalig verdelen" (today's calculator) and "Bewaarde verdelingen". |
| `P2-Pot` | A pot: a hero card ("You still owe", Settle up), the balance per person with bars, and expenses grouped by date. Guests are marked. |
| `P3-Delen` | The expense editor: amount, description, date, paid by, category chips, and a split segment (Equally / By shares / Amounts). The shares row uses a stepper, the per-person result is live, and a status line confirms that it adds up. |
| `P4-Bedragen` | Exact amounts that do not add up: "€4.40 still to split". Save is blocked until it adds up. |
| `P5-Geschiedenis` | History lines say who changed what. A guest's line names the Member who acted for them. |
| `P6-Web` | Direction for web only. 324 builds the phone. |

Deleting an expense asks for confirmation. A Member's name is a snapshot, so it stays after they leave.

## APP-325: settle up

| Artboard | What it shows |
| --- | --- |
| `A1-Afrekenen` | Fewest transfers to zero. "Pay" shows only on your own transfer to someone who has a link, and it opens the link. Everyone else gets "Mark paid". There is also a section with each person's payment link. |
| `A2-Verrekend` | After "Mark paid", a settlement row appears in Settled and a toast offers Undo. |
| `A3-Betaallink` | Adding a payment link (https only) for this pot. A Member can switch it on for other pots in the Group as well. A guest's link applies to this pot only. |
| `A4-Nul` | Everyone at zero, with a "Pot sluiten" button. A closed pot can be reopened. |
| `A5-Web` | Settle up on the web, as a dialog. |

## APP-326: receipt

| Artboard | What it shows |
| --- | --- |
| `B1-Bon` | A receipt photo on the expense, with a "Bon lezen" button. |
| `B2-Lezen` | Results sheet: amount, date, and shop as the description. Each has a tick. The note says it counts as one AI request. Buttons: "Fill in myself" and "Use these". |

If reading fails, the message is "Kon de bon niet lezen" and the Member fills in the fields themselves.

## APP-327: standing costs in a pot

| Artboard | What it shows |
| --- | --- |
| `V1-VasteLast` | A standing cost with an "In een pot" section: the pot and who pays. The footer explains the posting on the 1st. There is also an "Unlink" button. |
| `V2-Automatisch` | The pot with "Automatisch" badges on posted expenses. |

How posting works:
- On the 1st of every month in which the cost falls due, one expense is posted per cost. The `by_recurring_month` index keeps it idempotent.
- The expense is split by the cost's own split.
- An automatic expense can be edited in the pot without changing the cost.
- Unlinking stops future posts. Past posts stay.
- When linking, the cost's split must match Members who are in the pot. Otherwise linking asks you to add them.

## Copy (nl / en)

| Key | nl | en |
| --- | --- | --- |
| Module | Kosten delen | Shared costs |
| Sections | Open / Gesloten / Snel rekenen | Open / Closed / Quick maths |
| Hero | Jij betaalt nog / Jij krijgt nog | You still owe / You are owed |
| Balance footer | Saldo = betaald min aandeel. Iedereen in de pot ziet dit live. | Balance = paid minus share. Everyone in the pot sees this live. |
| Split modes | Gelijk / Naar delen / Bedragen | Equally / By shares / Amounts |
| Adds up | Klopt: {bedrag} verdeeld over {n} delen. Afrondingscenten gaan naar wie betaalde. | Adds up: {amount} split over {n} shares. Rounding cents go to the payer. |
| Not yet | Nog {bedrag} te verdelen. Bewaren kan pas als het klopt. | {amount} still to split. You can save once it adds up. |
| Categories | Eten en drinken / Boodschappen / Vervoer / Verblijf / Uitjes / Overig | Food and drink / Groceries / Transport / Stay / Outings / Other |
| Settle | Afrekenen / Betaal / Betaald | Settle up / Pay / Mark paid |
| Settle footer | Zo min mogelijk overboekingen. ‘Betaald’ bewaart een verrekening; die kun je ongedaan maken. | As few transfers as possible. ‘Mark paid’ saves a settlement; you can undo it. |
| Close | Pot sluiten | Close pot |
| Receipt | Bon / Bon lezen / Overnemen / Zelf invullen | Receipt / Read receipt / Use these / Fill in myself |
| Automatic | Automatisch | Automatic |
