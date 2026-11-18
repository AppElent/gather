---
type: decision
description: Read before changing Shared costs, its pots, expenses, balances or settlements, or migrating saved split scenarios.
version: 1.0.0
status: accepted
date: 2026-11-18
---

# Shared costs are expense pots with balances

[ADR-0025](0025-money-is-shared-and-manual-first.md) made Shared costs a
disposable calculator: a **Payment split** divides one event's costs, its
result is thrown away unless saved as an immutable **Saved scenario**, and it
"creates no debt, balance, settlement or history".
[ADR-0035](0035-money-tools-are-separate-modules.md) made Shared costs a Money
Module of its own.

A household does not split one event. It shares groceries for months, goes on
a weekend away with friends, and wants to know at any moment who is behind.
A calculator that forgets every result cannot answer that, and a saved
scenario cannot grow when the next receipt comes in. The Gather overhaul (18
Nov 2026) asked how Shared costs should work; on a decision card that day Eric
chose "Potjes met saldo (Tricount)". This ADR records that choice. Persisted
balances are hard to reverse: once Members rely on a running balance, removing
it loses what they owe each other.

## Decision

**Shared costs holds persistent expense pots within a Group.** A **Pot** is a
named, Group-scoped record, such as "Huishouden" or "Weekend Ardennen". It
holds **Expenses**, a **Balance** per participant and **Settlements**. A pot is
open while expenses are added and can be closed; a closed pot is read-only and
keeps its history.

**An Expense** records who paid, how much, when and what for, and how it splits
over the pot's participants: equally or by custom amount, as the Payment split
did. Further split modes are a design choice for APP-324. Editing or deleting an expense changes the balances that follow
from it.

**A Balance** is derived, never typed: what a participant paid minus their
share of every expense, adjusted by settlements. All balances in a pot sum to
zero. It is shown in the Group's home currency
([ADR-0040](0040-a-group-counts-in-euros.md)).

**A Settlement** records that one participant paid another to even out
balances. Gather can suggest who pays whom (APP-325), but a settlement exists
only when a Member records it.

**Balances are bookkeeping between participants**, not loans, advice or
payments. Gather moves no money, charges no interest, sends no reminders of a
debt and gives no advice.

**Manual-first stays.** The rule of ADR-0025 holds for pots: every figure is
one a Member typed (or confirmed from a receipt they added, APP-326). No bank
connection, no imported statement, no payment provider. A payment-request link
(Tikkie or a bank link) is only a link the Member pastes on a settlement or on
their own participant; Gather does not create, call or check it.

**Participants are current Members, plus optional named guests per pot.** A
guest is a name added to one pot for people outside the Group, such as friends
on a trip. A guest is not an account, cannot sign in, and does not appear in
any other pot. A Member who leaves the Group stays in the pots they took part
in, by the name they had, so balances still add up.

**Saved scenarios become closed pots.** Each existing Saved scenario migrates
into a closed pot with its payments as expenses, its participants, and its
frozen result as the balances (APP-328). After the migration the Payment split
calculator and the `splitScenarios` table retire.

## What this supersedes

- From ADR-0025: the paragraph that makes Shared costs "the only disposable
  calculator left in the Module", and its sentence that Shared costs "creates
  no debt, balance, settlement or history". The rest of ADR-0025 stands,
  including manual-first, Recurring costs and its **Split ratio**, which still
  creates no debt.
- From ADR-0035: nothing. Shared costs stays a separate Money Module.

## Consequences

- Shared costs is a record Members edit in place, like the other Money
  Modules; there is no **Finance calculator** left in Gather once APP-328
  ships.
- Pots, expenses, balances and settlements are Group content: they follow the
  Group's access rules ([ADR-0007](0007-a-write-happens-at-the-address-that-names-its-group.md)),
  data export and account deletion.
- A guest's name is personal data entered by a Member; it is exported and
  deleted with the pot.
- Recurring costs may later post into a pot each month by their split ratio
  (APP-327). The split ratio itself still creates no debt; the posted expense
  does.
- The schema change, the migration and every screen are their own issues
  (APP-324 to APP-329); this ADR adds no code.

## Rejected

- Keep the disposable calculator: it cannot answer "who is behind" across
  months.
- One running balance per Group instead of pots: a trip with friends and the
  household's groceries are different circles and must not net out.
- Guests as invited accounts: friends on one trip should not need to join the
  Group or install Gather.
- Bank connection or payment provider: breaks manual-first and makes Gather a
  payment service.

## Reopen when

- Members ask to pay through Gather rather than paste a link.
- A pot needs more than one currency.
