# Energy follow-ups: address, HA statistic, meter swap, HomeWizard, cheapest-hours push, export fields: final (APP-579, 720, 721, 498, 499, 634)

Eric approved this on 27 Nov 2026 ("Goed, alles bouwen"), together with the data model. These follow up on direction A from [README.md](README.md).

- **Canvas:** https://claude.ai/artifact/CvdwtVyuoN1Da3u4EumKeM, pages `APP-579` to `APP-634` and `Energie · datamodel`.
- **Source:** [`followups_final/`](followups_final/).
  - Phone artboards import `E27.dc.html`. Its `screen` prop takes `address`, `addressRemove`, `haList`, `haAdd`, `haNoDash`, `swapMenu`, `swapForm`, `swapDone`, `hwFind`, `hwPair`, `hwSource`, `pushSettings`, `pushBanner` or `contract`. It also takes `theme` and `lang`.
  - Web artboards import `E27Web.dc.html`, with `screen` set to `haAdd` or `swap`.
- **Data model:** [APP-579-634-data-model.md](APP-579-634-data-model.md).
- **Colours:** the Home group (amber). Numbers stay ink.

## APP-579: rename or remove the address

| Artboard | What it shows |
| --- | --- |
| `E579-Adres` | The address sheet, opened from Energy › Sources: name and the optional linked house. |
| `E579-Verwijder`, `E579-Dark` | "Adres verwijderen" (admins only). It confirms first and lists exactly what goes: sources, channels with value counts, contracts, the price source, solar and battery. Afterwards Energy shows the existing empty state. |

One address per Group stays the rule.

## APP-720: a Home Assistant statistic outside the dashboard

| Artboard | What it shows |
| --- | --- |
| `E720-Lijst` | The HA source gets a second section, "Zelf toegevoegd", with "Statistiek toevoegen…". |
| `E720-Toevoegen` | The sheet asks for the kind, the tariff and a statistic search. Only statistics with a fitting unit that are not used yet can be picked. The rest show greyed out, with the reason. |
| `E720-GeenDashboard` | Without an HA Energy dashboard, Gather says so and offers only "Statistiek toevoegen". |
| `E720-Web` | The same fields in a dialog on the web. |

## APP-721: meter swap

| Artboard | What it shows |
| --- | --- |
| `E721-Menu` | Every meter-reading channel gets ⋯ › "Meter vervangen". |
| `E721-Form` | Low and normal are selected together by default, gas is not. The sheet asks for the date, the last reading of the old meter (optional, and higher than the previous reading) and the first reading of the new meter (may be lower). |
| `E721-Klaar` | Old meters move to "Vervangen meters". Their readings keep counting in history, and connecting or disconnecting HA never brings them back. |
| `E721-Web` | The same fields in a dialog on the web. |

## APP-498: HomeWizard on the phone

| Artboard | What it shows |
| --- | --- |
| `E498-Zoek` | Discovery on the home wifi, behind the iOS Local Network permission. The callout says data arrives only when someone opens the app at home. |
| `E498-Knop` | "Press the button on your P1 meter", with a countdown. |
| `E498-Bron` | The source says where and when it was last read. When nobody was home, the next read fills the gap as one block. |

This needs a store build. It is high risk.

## APP-499: cheapest-hours notification

| Artboard | What it shows |
| --- | --- |
| `E499-Instellingen`, `E499-Dark` | Energy settings › Meldingen: "Goedkoopste uren morgen", "Ook negatieve prijzen" and the block length (1 to 4 hours). The setting is per person. |
| `E499-Melding` | The notification. Gather sends at most one a day, shortly after tomorrow's prices arrive, and none if they don't arrive. Tapping it opens Prices on tomorrow. |

## APP-634: export credit and export charge

| Artboard | What it shows |
| --- | --- |
| `E634-Contract`, `E634-Dark` | The contract gets two fields in place of one signed amount: "Terugleververgoeding" (credit) and "Terugleverkosten" (charge). Both are € per kWh, and either may be 0. |

## Copy (nl / en)

| Key | nl | en |
| --- | --- | --- |
| Remove | Adres verwijderen / Verwijder Thuis en de data | Remove address / Remove Thuis and its data |
| Added | Zelf toegevoegd / Statistiek toevoegen… | Added by you / Add statistic… |
| Swap | Meter vervangen / Vervangen meters | Replace meter / Replaced meters |
| HomeWizard | Alleen thuis, met de app open | Only at home, with the app open |
| Push | Goedkoopste uren morgen / Ook negatieve prijzen / Blok van | Cheapest hours tomorrow / Also negative prices / Block of |
| Contract | Terugleververgoeding / Terugleverkosten | Export credit / Export charge |
