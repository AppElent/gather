---
type: decision
description: Read before adding a home currency, an exchange rate, or a currency conversion to any Money Module.
version: 1.0.0
status: accepted
date: 2026-11-09
---

# A Group counts in euros

[ADR-0026](./0026-portfolio-overviews-are-information-not-advice.md) let a Group
choose a home currency and translate its Portfolio total with exchange rates a
Member entered. Nothing ever let a Member choose either: the `financeSettings`
table was written only by the Sample household seed, so every real Group already
counted in euros with no rates.

The owner chose to make that the rule rather than build the missing settings.
Every Group's home currency is the euro, and Gather stores no exchange rates.
`holdings.settings` stays, because installed phones read it by name
([ADR-0029](./0029-a-javascript-change-ships-over-the-air-and-a-native-one-does-not.md)),
and answers `{ homeCurrency: 'EUR', rates: [] }` for every Group.

This replaces ADR-0026's home-currency translation and stale exchange rate;
the rest of ADR-0026 stands.

## Consequences

- A holding still records its trading currency, and a new one is added in
  euros. One that does not trade in euros has no rate: the Portfolio overview
  counts it one-to-one and marks it as a Stale valuation, so the total never
  hides that it is unconverted.
- `financeSettings` is retired: `maintenance:deleteFinanceSettings` empties it
  in every deployment, after which the table is dropped
  ([active migrations](../migrations/README.md)).

## Rejected

- Building home-currency and rate settings: no household asked for them, and a
  rate typed in by hand is stale the day after.
