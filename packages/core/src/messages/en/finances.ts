import type {
  BuyingCostLine,
  CostCategory,
  CostFrequency,
  LoanPartKind,
  NetWorthSource,
  TransactionKind,
  TransferTaxBand,
} from '../../finance'

/**
 * Everything the Finances Module says.
 *
 * The closed sets below are `satisfies Record<Union, string>` against the seam
 * that defines them, so adding a cost category, a loan-part type or a
 * transaction kind without naming it here is a compile error rather than a row
 * that renders `undefined` (ADR-0011).
 *
 * Two words that are deliberately Dutch in both locales: the home-buying cost
 * lines are the names on a Dutch notary's invoice, and translating
 * *overdrachtsbelasting* into "transfer tax" on the screen a person is
 * comparing with that invoice would make it harder to read, not easier.
 */

/** Where a Net worth row's figure came from. */
export const sources = {
  manual: 'You entered this',
  house: 'From your house',
  mortgage: 'From this house’s mortgage',
  portfolio: 'From your holdings',
} satisfies Record<NetWorthSource, string>

export const categories = {
  housing: 'Housing',
  utilities: 'Utilities',
  insurance: 'Insurance',
  transport: 'Transport',
  health: 'Health',
  media: 'Media',
  other: 'Other',
} satisfies Record<CostCategory, string>

export const frequencies = {
  weekly: 'Every week',
  monthly: 'Every month',
  quarterly: 'Every quarter',
  halfYearly: 'Every six months',
  yearly: 'Every year',
} satisfies Record<CostFrequency, string>

export const loanPartKinds = {
  annuity: 'Annuity',
  linear: 'Linear',
  interestOnly: 'Interest-only',
} satisfies Record<LoanPartKind, string>

export const transferTaxBands = {
  starter: 'Starter',
  ownHome: 'Own home',
  other: 'Other',
} satisfies Record<TransferTaxBand, string>

export const buyingCostLines = {
  notary: 'Notaris',
  valuation: 'Taxatie',
  mortgageAdvice: 'Hypotheekadvies',
  structuralSurvey: 'Bouwkundige keuring',
  buyingAgent: 'Aankoopmakelaar',
} satisfies Record<BuyingCostLine, string>

export const transactionKinds = {
  buy: 'Buy',
  sell: 'Sale',
  dividend: 'Dividend',
  fee: 'Fee',
  adjustment: 'Manual adjustment',
} satisfies Record<TransactionKind, string>

export const finances = {
  sources,
  categories,
  frequencies,
  loanPartKinds,
  transferTaxBands,
  buyingCostLines,
  transactionKinds,

  /** The line every result ends on. */
  disclaimer:
    'Estimates from figures you enter. Gather is not a financial adviser.',

  actions: {
    add: 'Add',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    duplicate: 'Duplicate',
    rename: 'Rename',
    edit: 'Edit',
    done: 'Done',
    loading: 'Loading',
    refresh: 'Refresh',
    retry: 'Try again',
  },

  errors: {
    amount: 'Enter an amount.',
    name: 'Give it a name.',
    date: 'Pick a date.',
    positive: 'That has to be more than nothing.',
    percent: 'Enter a percentage between 0 and 100.',
    splitTotal: 'The shares have to add up to 100 %.',
    customTotal: 'The amounts have to add up to what was paid.',
    units: 'Enter how many units.',
    /** `{name}` is what is about to go. */
    confirmDelete: 'Delete {name}?',
    confirmDeleteBody: 'This is permanent, and there is no undo.',
  },

  index: {
    title: 'Finances',
    houses: 'Houses',
    money: 'Money',
    overviews: 'Overviews',
    addHouse: 'Add a house',
    /** `{monthly}` is the mortgage a month, `{parts}` how many loan parts. */
    houseSummary: '{monthly} a month · {parts}',
    houseNoMortgage: 'No mortgage calculation yet',
    /** `{count}` loan parts. */
    partCount: '{count} loan parts',
    onePart: '1 loan part',
    recurring: 'Recurring costs',
    /** `{count}` costs, `{share}` this Member's share a month. */
    recurringSummary: '{count} costs · your share {share}',
    recurringEmpty: 'What the household pays every month',
    savings: 'Savings goals',
    savingsEmpty: 'Save towards something together',
    /** `{name}` and `{date}` of the goal arriving soonest. */
    savingsSummary: '{name} on track for {date}',
    split: 'Shared costs',
    splitSummary: 'Who owes what, once',
    portfolio: 'Portfolio',
    portfolioEmpty: 'No holdings yet',
    netWorth: 'Net worth',
    netWorthEmpty: 'Nothing entered yet',
    emptyTitle: 'Nothing here yet',
    emptyBody:
      'Add the house you live in — or one you are only considering — and the mortgage, the buying costs and what it is worth hang off it.',
  },

  house: {
    /** The pushed screen's back title where the House has no name yet. */
    fallbackName: 'The house',
    newTitle: 'Add a house',
    newBody:
      'One field. Everything else — what it is worth, its mortgage, its buying costs — comes later.',
    nameLabel: 'What do you call it?',
    namePlaceholder: 'Kerkstraat 14',
    summaryCaption: 'Mortgage, all parts',
    /** `{parts}`, `{outstanding}`. */
    summarySub: '{parts} · {outstanding} outstanding',
    noMortgage: 'No mortgage calculation yet',
    /** `{date}` the first fixed rate ends. */
    firstFixEnds: 'First fix ends {date}',
    calculations: 'Mortgage calculations',
    addCalculation: 'Add a calculation',
    theHouse: 'The house',
    value: 'What it is worth',
    valueUnset: 'Not said yet',
    /** `{date}` the value was entered as at. */
    valueSub: 'Your estimate · {date}',
    bought: 'Bought',
    boughtUnset: 'Not bought',
    buyingCosts: 'Home-buying costs',
    /** `{cash}` needed in cash. */
    buyingCostsSub: '{cash} cash needed',
    buyingCostsUnset: 'Not worked out yet',
    notice:
      'A house you entered yourself. Gather looks nothing up, and the value is whatever you last put in.',
    calculationNamePlaceholder: 'What we pay now',
    /** A duplicate is named after the one it came from. */
    copySuffix: '{name} (copy)',
  },

  mortgage: {
    parts: 'Loan parts',
    addPart: 'Add a loan part',
    noParts: 'No loan parts yet',
    noPartsBody:
      'A mortgage here is made of its parts. Add the first one and the totals follow.',
    together: 'All of it together',
    outstanding: 'Outstanding',
    interestToPay: 'Interest still to pay',
    lastPaidOff: 'Last part paid off',
    charges: 'Early-repayment charges',
    whenFixesEnd: 'When the fixes end',
    /** `{count}` steps, `{from}` and `{to}` the first and last year. */
    stepsSummary: '{count} steps, {from} to {to}',
    oneStep: 'Nothing changes',
    oneStepSub: 'No fix ends while this mortgage runs',
    /** `{amount}` a month. */
    barMonthly: '{amount} a month',
    /** `{parts}` and `{outstanding}`. */
    barSub: '{parts} · {outstanding} outstanding',
    notice:
      'Each part is priced on its own and the totals are their sum. Rates after a fix ends are the ones you entered, not a forecast.',
    duplicateNotice:
      'Duplicating keeps this calculation as it is and gives you a copy to change.',
  },

  loanPart: {
    /** `{index}` is the part's place in the calculation, from 1. */
    title: 'Part {index}',
    kind: 'How it is repaid',
    amount: 'Amount',
    interest: 'Interest',
    fixedUntil: 'Fixed until',
    fixedUntilUnset: 'Variable',
    remainingTerm: 'Remaining term',
    /** `{years}` whole years. */
    years: '{years} years',
    /** `{months}` whole months. */
    months: '{months} months',
    whenFixEnds: 'When this fix ends',
    ifRateBecomes: 'If the rate becomes',
    addRate: 'Add a rate',
    /** `{date}` the fix ends. */
    fromDate: 'This part, from {date}',
    repayments: 'Extra repayments',
    addRepayment: 'Add a repayment',
    repaymentOnce: 'Once',
    repaymentMonthly: 'Every month',
    /** `{amount}` paid once in `{date}`. */
    onceSummary: '{amount} once',
    /** `{amount}` paid every month from `{date}`. */
    monthlySummary: '{amount} every month',
    /** `{date}` it starts. */
    fromMonth: 'from {date}',
    charge: 'Early-repayment charge',
    chargeUnset: 'Not entered',
    /** `{free}` % free a year, then `{rate}` %. */
    chargeSummary: '{free} % free a year, then {rate} %',
    freeAnnual: 'Free each year',
    chargeRate: 'Charged on the rest',
    /** `{amount}` a month for this part. */
    barThisPart: 'this part',
    /** `{amount}` for the whole calculation. */
    barAll: '{amount} for the whole mortgage',
    notice:
      'A repayment belongs to the part it is paid off, because that is the part whose interest it saves.',
  },

  timeline: {
    title: 'When the fixes end',
    eachStep: 'Each step',
    today: 'Today',
    todaySub: 'Every part on its current rate',
    /** `{index}` is the part number, `{rate}` the Member's own figure. */
    refix: 'Part {index} refixes at {rate} % — your figure',
    /** `{index}` is the part number. */
    paidOff: 'Part {index} is paid off',
    /** `{index}` is the part number. */
    repayment: 'A repayment on part {index} starts',
    /** `{month}` is when, `{amount}` what it costs then. */
    steepest: 'The steepest month is {month}, at {amount}.',
    /** `{amount}` more than today. */
    steepestDelta: '{amount} more than today.',
    steepestTail: 'Change a rate on any part and this list moves with it.',
    notice:
      'Every rate after a fix ends is one you entered on that part. Gather has no view on what rates will do.',
  },

  buyingCosts: {
    title: 'Home-buying costs',
    purchase: 'The purchase',
    price: 'Asking price',
    ownMoney: 'Your own money',
    mortgage: 'Mortgage',
    rateAndTerm: 'Interest · term',
    transferTax: 'Transfer tax',
    transferTaxLine: 'Overdrachtsbelasting',
    yourCosts: 'Costs you pay yourself',
    nhg: 'NHG',
    nhgOff: 'Off',
    shortBy: 'Short by',
    spareBy: 'Left over',
    /** `{own}` covers `{needed}`. */
    shortBody:
      'Your own money covers {own} of the {needed} needed. This is arithmetic, not an assessment of what you can afford.',
    /** `{amount}` cash needed. */
    barCash: 'cash needed',
    /** `{amount}` a month, `{term}` the term. */
    barMonthly: '{amount} a month · annuity · {term}',
    notice:
      'Every fee above is a figure you entered. Check them with your notary and lender.',
    emptyBody:
      'What a purchase needs in cash, on top of the price. Netherlands only, and every fee is one you enter.',
    start: 'Work out the costs',
  },

  recurringCosts: {
    title: 'Recurring costs',
    household: 'The household',
    yourShare: 'Your share',
    perMonth: 'Per month',
    perYear: 'Per year',
    aMonth: 'a month',
    aYear: 'a year',
    /** `{percent}` of the household total, on average. */
    shareAverage: '{percent} % on average',
    addCost: 'Add a cost',
    emptyTitle: 'No recurring costs yet',
    emptyBody:
      'Add what the household pays every month or every year, and Gather totals it — nothing else. No due dates, no payments, no reminders.',
    notice:
      'Totals from what you entered. Gather does not track payments or due dates, and a share is a ratio rather than a debt.',
    cost: {
      theCost: 'The cost',
      amount: 'Amount',
      howOften: 'How often',
      category: 'Category',
      note: 'Note',
      noteUnset: 'Nothing written down',
      notePlaceholder: 'Renews in March',
      whoPays: 'Who pays what',
      changeSplit: 'Change the split',
      splitEven: 'Split evenly',
      splitUnset: 'Not divided',
      namePlaceholder: 'Car insurance',
      notice:
        'A share is how you divide this cost between you. Nothing accrues and nothing is settled — that is what Shared costs is for.',
      comparisonSoon: 'Comparing what this could cost elsewhere comes later.',
    },
  },

  savings: {
    title: 'Savings goals',
    addGoal: 'Add a goal',
    emptyTitle: 'No savings goals yet',
    emptyBody:
      'Set a target and a date, enter what you have put aside, and Gather says what a month has to be.',
    namePlaceholder: 'New kitchen',
    target: 'Target',
    targetDate: 'By when',
    /** `{saved}` of `{target}` by `{date}`. */
    ofTargetBy: 'of {target} by {date}',
    /** `{percent}` saved. */
    percentSaved: '{percent} % saved',
    /** `{amount}` still to go. */
    toGo: '{amount} to go',
    reached: 'Reached',
    whatItTakes: 'What it takes',
    /** `{date}` is the target date. */
    toMake: 'To make {date}',
    /** `{count}` months from today. */
    monthsFromToday: '{count} months from today',
    thisMonthAlready: 'The date has arrived',
    /** `{amount}` per month. */
    perMonth: '{amount} / mo',
    /** `{amount}` a month is the current pace. */
    atPace: 'At {amount} a month',
    yourPace: 'Your current pace',
    noPace: 'Say what you put aside',
    progress: 'Progress',
    savedSoFar: 'Saved so far',
    puttingAside: 'Putting aside',
    puttingAsideSub: 'What you plan each month',
    /** `{date}` and `{name}` of whoever last updated it. */
    updatedBy: 'Updated {date} by {name}',
    updateProgress: 'Update progress',
    behind: 'Behind the target date',
    notice:
      'You enter what you have saved. Gather does not read it from an account.',
  },

  split: {
    title: 'Shared costs',
    what: 'What was it for',
    whatPlaceholder: 'Ski trip',
    whoPaid: 'Who paid',
    addPayment: 'Add a payment',
    paymentFor: 'What for',
    splitBetween: 'Split between',
    equally: 'Equally',
    custom: 'Custom',
    toSettle: 'To settle up',
    /** `{from}` pays `{to}`. */
    pays: '{from} pays {to}',
    settled: 'Nothing to settle',
    /** `{amount}` each. */
    barEach: 'each',
    /** `{total}` across `{count}` people. */
    barSub: '{total} across {count} people',
    saved: 'Saved splits',
    saveThis: 'Save this',
    saveName: 'What to call it',
    emptyTitle: 'Nothing to divide yet',
    emptyBody:
      'Add what each of you paid for one thing, and Gather says who owes whom. It keeps nothing unless you save it.',
    immutable:
      'A saved split keeps the figures that produced it. Duplicate it to change anything.',
    notice:
      'Gather does not keep this. Settle it between yourselves — no balances, no history.',
  },

  portfolio: {
    title: 'Portfolio',
    /** `{currency}` is the Group's home currency. */
    totalValue: 'Total value · {currency}',
    sinceYouBought: 'since you bought',
    /** `{count}` holdings. */
    holdingCount: '{count} holdings',
    oneHolding: '1 holding',
    addHolding: 'Add a holding',
    emptyTitle: 'No holdings yet',
    emptyBody:
      'Add a stock or ETF and Gather shows what it is worth, with the time its price came from.',
    informational: 'Informational',
    realized: 'Realised gains',
    dividends: 'Dividends received',
    fees: 'Fees paid',
    /** `{time}` the price was taken. */
    pricesAt: 'Prices {time}',
    /** `{time}` the conversion was taken. */
    fxAt: '{pair} {time}',
    stale: 'Could not refresh just now. Pull down to try again.',
    staleBadge: 'stale',
    notice:
      'Average cost, for information only — not tax figures, not advice. Pull down to refresh prices.',
    /** `{units}` held at `{price}`. */
    unitsAt: '{units} units · {price}',
    holding: {
      listedOnly: 'Listed stocks and ETFs only',
      symbol: 'Ticker',
      name: 'What it is called',
      exchange: 'Exchange',
      currency: 'Currency',
      unitsHeld: 'Units held',
      averageCost: 'Average cost',
      /** `{amount}` invested. */
      onInvested: 'on {amount} invested',
      /** `{date}` the opening position is as at. */
      since: 'Since {date}',
      openingPosition: 'Opening position',
      openingBody:
        'Whichever you pick, this becomes an opening position you can add buys, sales, dividends and fees to afterwards.',
      knowWhatIHold: 'I know what I hold',
      haveHistory: 'I have my history',
      units: 'Units',
      averagePrice: 'Average price',
      asAt: 'As at',
      price: 'Price',
      pricePerUnit: 'Price per unit',
      perUnit: 'Per unit',
      fee: 'Fee',
      addTransaction: 'Add a transaction',
      recordAdjustment: 'Record an adjustment',
      adjustmentBody:
        'A split, a merger or an ETF change. Say what you hold now and what it cost on average; Gather changes nothing on its own.',
      adjustmentNote: 'What happened',
      /** The manual price, until quotes arrive. */
      lastPrice: 'Last known price',
      lastPriceHint: 'The price you last entered, and when you entered it.',
      notice:
        'Splits, mergers and ETF changes are yours to enter. Gather never rewrites a holding on its own.',
    },
  },

  netWorth: {
    title: 'Net worth',
    today: 'Today',
    /** `{amount}` and `{date}` of the last snapshot. */
    sinceSnapshot: '{amount} more than your last snapshot on {date}',
    /** `{amount}` and `{date}`. */
    downSinceSnapshot: '{amount} less than your last snapshot on {date}',
    noSnapshot: 'No snapshot taken yet',
    assets: 'Assets',
    liabilities: 'Liabilities',
    addAsset: 'Add an asset',
    addLiability: 'Add a liability',
    takeSnapshot: 'Take a snapshot',
    snapshots: 'Snapshots',
    /** `{name}` of whoever took it. */
    takenBy: 'Taken by {name}',
    label: 'What is it',
    amount: 'How much',
    emptyTitle: 'Nothing added yet',
    emptyBody:
      'Enter what the household owns and owes. Your house and your holdings arrive on their own.',
    snapshotBody:
      'A snapshot freezes today’s figures, including the moment the prices came from. It is never edited afterwards.',
    notice:
      'The calculated rows come from your house and your holdings rather than from anything you typed. A snapshot freezes all of it and is never edited afterwards.',
  },
}
