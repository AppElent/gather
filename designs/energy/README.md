# Energy — design study (APP-491)

A new Module that shows what the household's home uses, produces and pays for
electricity and gas, priced per hour against dynamic prices plus the
household's own contract, with solar panels and a home battery. Data comes from
swappable sources (Home Assistant, meter readings; Enelogic and HomeWizard
direct later). Gather only reads; it never controls devices. The phone leads;
the web follows with the same functions in the APP-300 web module layout (list
left, panel right).

**Canvas:** https://claude.ai/artifact/CvdwtVyuoN1Da3u4EumKeM ("Gather — Energie").
**Approved:** all pages, by Eric, 20 November 2026, with the home screen as
direction **A, Today first**. B (Costs first) stays here and on the canvas's
History page as the round's record.
**Data model:** [APP-491-data-model.md](APP-491-data-model.md), approved on the
same card.
**Proposal:** https://claude.ai/artifact/4fANWhgcQX5unA2j5azizC (Dutch).

Group: **Home** (`home-fill`, `home-on`, `home-text`, `home-wash`). Group colour
only on the tile and each screen's primary button. Every number, bar and
progress fill is `ink`; no traffic-light colours.

## Files

| File | Artboard | Issue |
| --- | --- | --- |
| `Main.dc.html` | Shared phone part; props `screen`, `theme`, `tested`. Default: home A, light | APP-492 |
| `Home-Dark.dc.html` | Home A, dark | APP-492 |
| `Home-B.dc.html` | Home B, Costs first (not chosen) | — |
| `Empty.dc.html` | Empty Module: add the first address, pick a source | APP-492 |
| `Prices.dc.html` | Prices today / tomorrow | APP-493 |
| `Feed.dc.html` | Price source, bring your own key | APP-493 |
| `Costs.dc.html` | Costs per month, with / without net metering | APP-494 |
| `Contract.dc.html` | Contract and tariffs | APP-494 |
| `Solar.dc.html` | Solar and battery | APP-496 |
| `Sources.dc.html` | Sources, channels, add a source | APP-495 |
| `Connect.dc.html` | Connect Home Assistant (after a successful test) | APP-495 |
| `Reading.dc.html` | Enter meter readings, with the lower-reading error | APP-494 |
| `canvas.json` | Positions, titles, sticky notes (brief and rationale) | |

The artboards are a visual reference. Build from this companion and the phone's
own tokens and components (`apps/mobile/DESIGN_SYSTEM.md`), not from the
artboards' markup. Sample data (site "Thuis", Zonneplan dynamic contract,
4,200 Wp solar, 10 kWh battery, Friday 20 November 19:55) and every tariff
value are illustration only.

## Vocabulary

| Concept | NL | EN |
| --- | --- | --- |
| Module | Energie | Energy |
| Site | Adres | Address |
| Source | Bron | Source |
| Channel | Kanaal | Channel |
| Price source | Prijsbron | Price source |
| Net metering | Salderen | Net metering |
| Meter reading | Meterstand | Meter reading |
| Self-sufficiency | Zelfvoorziening | Self-sufficiency |
| Off-peak / normal tariff | Dal / normaal | Off-peak / normal |

## 1. Home, direction A (APP-492)

Wash screen in the Home group, back to the Module's tab stack, large title
`Energie` / `Energy`. `tile-l` with the bolt glyph; summary line 1 the site
name, line 2 `{source} · bijgewerkt {HH:MM}` / `{source} · updated {HH:MM}`.
The source and last update are always visible so stale data never looks
current. Bar button `…` opens Sources, Contract, Price source.

1. **Now card** (`home-wash`, `radius-now`): caption `Stroom nu, {HH}:00–{HH+1}:00`;
   the all-in price per kWh in `numeral-xl`; a word judgement (`Duur` /
   `Gemiddeld` / `Goedkoop` by distance from today's average) with the
   percentage; the next cheapest 3-hour block (rest of today, else tomorrow
   once known) with its average.
2. **Price per hour today**: 24 bars, past hours `surface-2`, current hour an
   ink outline, the rest `hairStrong`; axis 00/06/12/18/24. Whole card opens
   Prices. The figure has an `aria-label` that states the cheapest block, the
   most expensive hour and the price now.
3. **Vandaag tot nu**: 2×2 facts (used, produced, exported, electricity cost)
   in `numeral-l`, then one gas row. Facts that need a channel the site lacks
   are left out, not shown as zero.
4. **Battery card** (only with a battery channel): state of charge, power
   direction, today's value. Opens Solar and battery.
5. **Rows**: Prijzen, Kosten per maand, Zon en batterij, Bronnen, each with a
   live subtitle.
6. Footnote: price source + contract supplier, "incl. VAT and energy tax".

B (not chosen) put the month total in the Now card and the prices in a compact
strip. It is kept as the record only.

## 2. Empty Module (APP-492)

Per ADR-0022 an empty Module invites its first thing: a card with one line of
value, one line of what comes next, primary `Voeg je adres toe`. The form asks
name (default `Thuis`), an optional House link, and a radio choice: Home
Assistant (recommended) or meter readings. `Verder` goes to Connect or Readings.
Prices work at once with the default source, no key needed.

## 3. Prices (APP-493)

Segmented `Vandaag` / `Morgen`. Hour bars at 150 pt; the cheapest 3
consecutive hours in ink, the current hour (today) or the most expensive hour
(tomorrow) as an ink outline, with a legend. Facts: average, cheapest 3 hours,
most expensive hour. Tomorrow appears around 13:30; before that the tab shows
when it is expected. When the market price is negative, a card says exporting
costs money in that window and how much per kWh. "Zo is € x opgebouwd": a
stacked bar and four rows (market price, supplier markup, energy tax, VAT).
Row to Price source with the provider and last fetch time.

Hourly price = average of the four quarter-hour prices. Quarter-hour costs
come only from a source with quarter-hour data.

## 4. Price source (APP-493)

Radio list per site: EnergyZero (no key, default), ENTSO-E (own token), Tibber
(own API key, account prices incl. contract and taxes), "Meer leveranciers"
disabled. A provider that needs a key shows one secure field with where to get
it. The key is write-only: after saving it is never shown again; admins of the
Group can replace it. With account prices the contract's electricity markup and
taxes are skipped; gas and fixed costs still come from the contract. A failed
fetch shows the last good time and the error in words.

## 5. Costs per month (APP-494)

Month pill with previous/next. Segmented `Met salderen` / `Zonder salderen`.
Now card: total so far and either the previous month plus a forecast, or (without
net metering) what the same month costs from 1 January 2027 and the difference.
Daily cost bars (future days dashed). Breakdown rows: grid import, export
(netted vs export price), gas, fixed costs, energy tax credit. Row to Contract.
From 2027 the toggle disappears and costs are always without net metering.

## 6. Contract (APP-494)

Segmented `Dynamisch` / `Vast`. Groups: contract (supplier, valid from),
electricity (dynamic: markup, export fee, export costs, energy tax; fixed: T2,
T1, export), gas, fixed (monthly fixed costs, yearly tax credit, VAT). Amounts
excl. VAT as on the contract, decimal keypad, unit beside each field. Net
metering switch with "turns off on 1 January 2027". Earlier contracts listed
read-only; new tariffs = a new contract from that date.

## 7. Solar and battery (APP-496)

Segmented today / this month. Solar: produced, self-used (with %), exported, a
two-part bar and a self-sufficiency sentence. Battery: state of charge with
kWh, rows charged and discharged with the average price at the time, value in
bold, the formula in a footnote. Payback per asset only when a purchase price
exists. `Paneel of batterij toevoegen`. A site without hourly data shows why
these insights are missing instead of zeros.

## 8. Sources (APP-495)

Sources list with status and last update (an overdue manual source in `danger`
words). Channels list: name and its one source. "Bron toevoegen": Home
Assistant, meter readings, Enelogic (Binnenkort), HomeWizard direct
(Binnenkort, "via Home Assistant it already works").

## 9. Connect Home Assistant (APP-495)

Admins only. Step 1: external URL and long-lived token (secure), with where to
find both; `Verbinding testen` shows the HA version and the channels found in
its Energy dashboard. Step 2: one switch per proposed channel with its entity id
(tap to pick another sensor); a channel another source already supplies starts
off. Switch "Geschiedenis ophalen", the last 12 months hourly, on by default.
`Koppelen`. Footer: token stays on the server, read-only, never controls
anything.

## 10. Meter readings (APP-494)

Date, then per manual channel the previous reading and date and a decimal
field. A lower value than the previous one is refused inline (`danger`, role
alert): "Lager dan de vorige stand (x). Nieuwe meter? Voeg dan een nieuw kanaal
toe onder Bronnen." Footnote: the difference is spread over the days between
and those days count as estimated.

## States to cover in the build

- Source error / needs reconnect: summary line 2 shows the problem in words;
  Sources row shows it; data stays visible with its last update time.
- Prices for tomorrow not in yet; price fetch failed.
- Site with only manual data: Home shows daily estimates, no hour bars of
  usage; Solar shows the explanation.
- Dark theme for every screen (Home dark on the canvas is the reference).
- Dynamic Type: facts wrap; numerals `maxFontSizeMultiplier` 1.5.
