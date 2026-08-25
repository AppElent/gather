# Mobile-first Finances / Money tools

## Problem Statement

Gather exposes separate placeholder Modules for Finances and Bills &
subscriptions, so a Group cannot currently use the app to explore shared money
decisions or understand its investments. Households need a calm mobile-first
place for transparent calculations and lightweight overviews without turning
Gather into a bank-connected ledger, broker, tax product, or financial adviser.

## Solution

Replace the Bills & subscriptions surface with one Group-scoped **Finances**
Module. Its mobile index leads with decision tools — Mortgage, Home-buying
costs, Recurring costs, Subscription comparison, Shared costs, and Savings
goals — followed by ongoing Portfolio and Net worth overviews.

Calculations are transparent and disposable. A Member may explicitly save an
immutable **Saved scenario** to the Group; changing it creates a duplicate.
Portfolio and Net worth have their own durable records: investments are
holdings built from a dated opening position and optional transactions, while
Net worth history is made only from explicit dated snapshots. The supplied
mobile design will define the visual composition and final screen-level layout;
it must preserve the interaction, state, and domain rules in this spec.

## User Stories

1. As a Member, I want to open one Finances Module from the phone, so that I can find every shared money tool without navigating between placeholder Modules.
2. As a Member, I want the Finances index to prioritize decisions I need to make, so that Mortgage, home buying, recurring costs, subscription comparison, shared costs, and savings goals are immediately discoverable.
3. As a Member, I want Portfolio and Net worth to appear after the decision tools, so that ongoing overviews do not obscure quick calculations.
4. As a Member, I want every finance record and saved result visible to my Group's Members, so that household money discussions use the same information.
5. As a Member, I want to calculate a result without saving it, so that I can explore an idea without creating permanent Group content.
6. As a Member, I want to save a useful calculation as a Group scenario, so that the household can revisit a decision together.
7. As a Member, I want a saved scenario to remain immutable, so that a comparison always retains the assumptions that produced it.
8. As a Member, I want to duplicate a saved scenario before changing it, so that I can compare alternatives without silently overwriting the original.
9. As a Member, I want each calculator result to state its assumptions and show that it is an estimate rather than financial advice, so that I can judge its limits.
10. As a Member, I want to calculate an existing annuity mortgage's payment and repayment path, so that I can understand my current loan.
11. As a Member, I want to calculate a hypothetical annuity mortgage, so that I can explore a potential purchase without an affordability assessment.
12. As a Member, I want to calculate an existing or hypothetical linear mortgage, so that the tool reflects a common Dutch mortgage structure.
13. As a Member, I want to model a one-off extra mortgage repayment, so that I can see the effect of using a bonus or windfall.
14. As a Member, I want to model recurring extra repayments, so that I can compare a higher ongoing payment with the ordinary schedule.
15. As a Member, I want to enter an optional known early-repayment charge, so that the result reflects my lender's actual terms without Gather guessing those terms.
16. As a Member, I want to compare fixed-rate-expiry outcomes using my own lower, expected, and higher rate assumptions, so that I can discuss a range without treating Gather as a rate forecaster.
17. As a Member, I want to calculate Netherlands-specific home-buying cash needs, so that I can understand the money required beyond the purchase price.
18. As a Member, I want Home-buying costs to show an estimated monthly mortgage payment, so that I can compare prospective homes without the app deciding what I can afford.
19. As a Member, I want to enter repeating household costs and see monthly and annual totals, so that I can understand recurring commitments without tracking payments or due dates.
20. As a Member, I want to compare manually entered subscription plans by monthly and annual cost, so that I can choose the better-value plan.
21. As a Member, I want to test a hypothetical subscription price increase, so that I can understand its annual impact.
22. As a Member, I want to enter several payments made by different current Group Members for one event, so that a trip, meal, or household purchase can be divided fairly.
23. As a Member, I want Shared costs to divide an event equally or by custom amounts, so that the calculation matches the agreement.
24. As a Member, I want Shared costs to show who should contribute after all event payments are considered, so that I can settle the one event.
25. As a Member, I want a Shared costs result not to create an ongoing debt or settlement history, so that a one-off calculation remains lightweight.
26. As a Member, I want to create a Group Savings goal with a target amount and desired date, so that we can plan toward a shared outcome.
27. As a Member, I want to enter the current saved amount manually, so that Savings goals work without bank connections or transaction history.
28. As a Member, I want to see the required monthly saving amount and expected completion date, so that I can adjust our goal or contribution.
29. As a Member, I want to add a listed stock or ETF by searching and selecting a precise instrument, so that exchange and currency ambiguity do not corrupt the Portfolio overview.
30. As a Member, I want to establish an Investment holding from a dated current quantity and average purchase price, so that I can start tracking existing investments without reconstructing history.
31. As a Member, I want to add buys, sales, dividends, and fees after an opening position, so that the holding's current position and informational performance remain meaningful.
32. As a Member, I want the Portfolio overview to show current value, invested amount, unrealized performance, realized gain, and dividend totals, so that I can understand the portfolio at a glance.
33. As a Member, I want Portfolio performance to use average cost consistently, so that results align with direct opening-position entry and remain simple to understand.
34. As a Member, I want each quote and currency conversion timestamp displayed, so that I know how current a valuation is.
35. As a Member, I want the last known valuation visibly marked stale when refresh fails, so that I retain useful context without mistaking old data for current data.
36. As a Member, I want to correct a split, merger, or ETF change through a Manual adjustment, so that Gather does not silently apply an unreliable corporate action.
37. As a Member, I want to see foreign-currency holdings in their trading currency and the aggregate in the Group home currency, so that a combined total remains understandable.
38. As a Member, I want to enter current asset and liability values for Net worth, so that we can see a household-level snapshot without account aggregation.
39. As a Member, I want Net worth to include the current calculated Portfolio value, so that investments do not need to be re-entered.
40. As a Member, I want to explicitly save a dated Net worth snapshot, so that I can compare deliberate checkpoints without background valuation history.
41. As a Member, I want clear empty states for each tool and overview, so that I know the single useful next action.
42. As a Member, I want validation failures and unavailable market data explained in my language, so that I can correct inputs or understand the temporary limitation.
43. As a Member, I want the Finance experience to use native mobile navigation, forms, sheets, and feedback, so that it feels coherent with the rest of Gather.

## Implementation Decisions

- Finances is a single Group-scoped Module. The former Bills & subscriptions Module is removed from the mobile catalogue and its recurring-cost purpose becomes a Finances tool.
- The Module has a mobile index with decision tools first and Portfolio and Net worth overview cards after them. Each tool has a dedicated native route and screen; nested screens use the standard mobile parent/back behavior.
- The user-provided design attachment is pending. It is the visual specification for screen layout, hierarchy, cards, empty states, and interaction affordances. It must not relax the domain decisions in this spec or the applicable ADRs.
- Calculator inputs and results use the established mobile form and native-sheet conventions. A result can be discarded or explicitly saved as an immutable Saved scenario. Editing a saved scenario duplicates it first.
- Mortgage calculations support annuity and linear structures; existing and hypothetical loans; one-off and recurring extra repayments; optional Member-entered early-repayment charges; and fixed-rate-expiry comparisons based only on Member-entered rate assumptions. The tool is Netherlands-specific where local buying costs apply and does not assess affordability.
- Recurring costs calculates monthly and annual totals from manually entered repeating costs. It does not create payment instances, payment status, due dates, reminders, renewal dates, bank data, or a ledger.
- Subscription comparison compares manually entered plan values and optional price-rise assumptions. It does not manage cancellation or renewal workflows.
- Shared costs is a single-event calculation. It accepts several payments from current Group Members and equal or custom allocations, calculates the contribution outcome, and never creates a running debt, transfer, reimbursement, or settlement history.
- Savings goals store a Group target, target date, and manually entered saved amount. Required monthly saving and expected completion date are calculated, not entered.
- Portfolio supports listed stocks and ETFs only. Instrument selection retains a precise instrument identity rather than treating a typed ticker as sufficient.
- An Investment holding starts from a dated opening position or transaction history; later buys, sales, dividends, and fees build on that position. Informational realized and unrealized performance uses Average cost and is never tax reporting.
- Market quotes and currency conversion are delayed or end-of-day and always timestamped. A refresh failure retains and labels a Stale valuation. There are no live quotes, broker connections, price predictions, or recommendations.
- Corporate actions are represented through a Member-entered Manual adjustment, rather than automated provider-driven changes.
- Each holding preserves its trading currency. Group totals use a selected Group home currency and show the conversion timestamp.
- Net worth stores manually entered asset and liability values; its Portfolio contribution is calculated. It records only explicit dated snapshots and has no background valuation job or account aggregation.
- All user-visible copy remains in Gather's typed English and Dutch message trees. The application follows its established mobile interaction vocabulary, including native titles, native sheets, accurate loading states, explicit error feedback, and accessibility labels.

## Testing Decisions

- Good tests assert a Member-visible calculation, authorization outcome, persisted scenario/snapshot behavior, route destination, or rendered mobile state. They do not assert private component structure or implementation details.
- A pure finance-calculation seam is the primary test seam. It covers mortgage repayment and overpayment schedules; fixed-rate comparison assumptions; home-buying and recurring-cost totals; subscription comparison; shared-cost allocation; savings-goal dates and amounts; Average cost performance; currency conversion; stale valuations; and Net worth totals.
- Convex query and mutation tests cover Group access, Member input validation, immutable Saved scenarios and duplication, holdings and transactions, Manual adjustments, and explicit Net worth snapshots. They must preserve the project's rule that an inaccessible Group record is indistinguishable from a missing one.
- Mobile screen tests cover the Finances index ordering, navigation into each dedicated tool, rendered calculator results, validation text, empty states, stale-price presentation, and accessible labels. Use the app's existing component-test helpers and i18n rendering conventions.
- On-device Android verification covers the primary flows: opening Finances, creating and saving a scenario, duplicating it, calculating a Shared costs event, adding a holding, entering a transaction, observing stale data, and saving a Net worth snapshot. Use `agent-device` interactions and assert the resulting UI state rather than relying on screenshots alone.
- Existing portable-core module registry tests are extended for the Finance-module catalogue change. Existing mobile pure-function tests in the Baby Module are prior art for calculation seams; existing Convex tests are prior art for authorization and mutation behavior.

## Out of Scope

- Bank or brokerage connections, statement imports, CSV import/export, and automatic account aggregation.
- A household payment ledger, bill payment status, due dates, reminders, renewal reminders, transaction reconciliation, or budget envelopes.
- Persistent member-to-member debts, settlement history, reimbursements, or money transfers.
- Mortgage affordability decisions, lender-specific penalty calculations, rate forecasts, personalized lending advice, or any financial advice.
- Mortgage structures beyond annuity and linear, including interest-only or mixed-loan modeling.
- Live/intraday market quotes, price predictions, watchlists, market research, buy/sell recommendations, tax reporting, or historical portfolio-value charts.
- Assets beyond listed stocks and ETFs, including mutual funds, crypto, options, pensions, and unlisted assets.
- Automated corporate-action processing.
- Automatic Net worth history or scheduled valuation snapshots.
- Web implementation. Mobile is the first delivery; shared calculation and backend seams may be reusable later.

## Further Notes

- The relevant vocabulary and durable boundaries are defined in `CONTEXT.md`, ADR-0025, and ADR-0026. They take precedence over synonymous names in future implementation discussions.
- The supplied design attachment has not yet been created. Attach it to the published issue and update this spec only where necessary to make its agreed visual and interaction decisions explicit.
- The scope is intentionally broad. Implement it as a series of independently shippable tool slices that share one calculation seam and the Finances index rather than as a single untestable release.
