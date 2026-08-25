# Money is shared and entered by hand

Money is shared within a Group and every figure in it is one a Member typed.
Gather connects to no bank, imports no file, looks up no property, and reads no
statement; what it knows is what somebody entered, and what it produces is
arithmetic on that. The Module is called Finances, it is one Module, and the
existing Bills & subscriptions Module folds into it as Recurring costs.

Most of what Finances holds is a **record a Group edits in place**, not a
disposable calculation. A **House** is the container for what a home costs: a
Member enters it by hand — it may be one the Group owns or one they are only
considering — and it holds one **Home-buying costs** and one or more **Mortgage
calculations**. A mortgage calculation is not one loan. It is made of **loan
parts**, each with its own amount, structure, interest rate, fixed-rate end date
and remaining term, each priced on its own, with the calculation's totals being
their sum; extra repayments and an optional early-repayment charge belong to the
part whose interest they change. Because each part's fix ends on its own date,
the fixed-rate-expiry answer is a series of dated steps rather than one figure,
computed from rate assumptions the Member entered and shown with an
estimate-not-advice notice. Loan parts are annuity, linear, or interest-only.
A Member asks "what if" by **duplicating** a calculation rather than by editing
one and losing what it said before.

**Shared costs is the only disposable calculator left in the Module.** It
divides one event's costs among current Group Members, collecting several
Members' payments before calculating contributions, equally or by custom amount,
and its result is disposable unless explicitly saved as an immutable Group
scenario that Members duplicate to change. It creates no debt, balance,
settlement or history, and neither does anything else here.

The remaining tools are records of the same kind. **Recurring costs** turns
repeating costs into monthly and annual totals; each cost carries a category
from a fixed set, a split ratio across current Members, and its own screen,
where a future comparison of what a cost could be bought for will live. A split
ratio divides a standing cost and is not a debt. **Savings goals** hold a target
amount and date with progress entered by hand, estimating the monthly amount
required and the expected completion date. **Home-buying costs** is
Netherlands-specific and calculates the cash needed and an estimated monthly
payment from rates and fees the Member entered; it does not assess what a Group
can afford. **Net worth** consists only of explicitly saved dated snapshots, and
its current view derives three rows rather than asking for them again: the
House's value, that House's mortgage balance, and the Portfolio's calculated
value (ADR-0026). Its other values are manual.

Finances tracks no due dates, no payments, and no renewals. The separately
agreed Subscription comparison tool is **struck**: comparing what one cost could
be bought for belongs on that cost's own screen, inside Recurring costs, rather
than in a tool of its own.

On mobile the Finances index leads with the Group's Houses, then the money
records, and ends with the Portfolio and Net worth overviews.
