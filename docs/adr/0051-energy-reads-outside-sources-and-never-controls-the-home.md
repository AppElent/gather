---
type: decision
description: Read before changing where Energy data comes from, or before letting Gather act on a device.
version: 1.0.0
status: accepted
date: 2026-11-21
---

# Energy reads outside sources, and never controls the home

The Energy Module shows what a Group's home uses, produces and pays for
electricity and gas, hour by hour. Unlike Finances, most of its numbers are not
typed: they come from a meter, a home-automation hub or a price feed. Energy may
read those outside sources. It does so under the cache model of
[ADR-0020](0020-external-module-backends-are-authoritative.md),
keeps typing meter readings as a full source of its own, and never sends a
command to a device.

## Rules

- **Read-only sources, cached.** A source (Home Assistant, Enelogic,
  HomeWizard) or a price feed (EnergyZero, ENTSO-E, Tibber) is authoritative
  for what it reports. Gather stores what it fetched (readings, hourly
  intervals, prices) as a cache, and every source and feed carries an explicit
  status (`ok`, `syncing`, `error`, `needsReconnect` / `needsKey`) so stale data
  never passes for fresh data. Gather writes nothing back to a source.
- **Manual is a full source.** Typing meter readings is a source kind like any
  other, not a fallback or a degraded mode. A Group with no hub gets usage,
  estimated per day, from what it typed.
- **Group-scoped connections.** A source or feed belongs to an address
  (`energySites`) of one Group. Its token or key is server-only: it is never
  returned by a query and never exported.
- **Never control.** Gather does not switch, schedule or steer a device: no
  charging a battery, no turning on a heat pump, no automations. Advice such as
  "the cheapest hours tomorrow" is shown; acting on it is the person's, or their
  hub's.
- **Market prices belong to no Group.** A public price (no feed of the Group's
  own) is reference data shared by every Group; an account price belongs to its
  feed's Group and goes with it.

## Why ADR-0025's manual-only rule does not apply

[ADR-0025](0025-money-is-shared-and-manual-first.md) keeps money manual:
Gather connects to no bank and reads no statement, because those records are
the household's own bookkeeping and the trust cost of a bank connection is
high. Energy's figures are measurements, not bookkeeping. A meter's reading has
no meaning the household chose, the sources are on their own network or are
public price lists, and a reading cannot move money. Reading them is the only
way to get hourly figures at all; typing 8,800 hours a year is not a real
option. The euro amounts Energy shows are arithmetic on those readings and a
contract the Group typed; they are not Finances records and do not flow into
them.

## Consequences

- The data model is the one approved in
  [`designs/energy/APP-491-data-model.md`](../../designs/energy/APP-491-data-model.md):
  sites, contracts, sources, channels, assets, readings, hourly intervals,
  price feeds and prices.
- Every source adapter (APP-495 and later) is a reader that fills the cache; a
  failing source shows its status and its last good data, never a guess.
- Deleting a Group deletes its Energy rows, its account prices included; market
  prices stay. The data export carries the Group's Energy rows without secrets
  and leaves prices out as reference data.
