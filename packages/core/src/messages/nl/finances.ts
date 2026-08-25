import type { finances as enFinances } from '../en/finances'

/**
 * Dutch. `satisfies typeof enFinances` is what keeps coverage honest — a key
 * that exists in one locale and not the other fails `pnpm typecheck`.
 *
 * The mortgage vocabulary is the one a Dutch household already uses:
 * *leningdeel* for a loan part, *annuïteit* / *lineair* / *aflossingsvrij* for
 * how one is repaid, and the notary's own words for the buying costs. The
 * English tree keeps those Dutch fee names too — see the note there.
 */
export const finances = {
  sources: {
    manual: 'Zelf ingevuld',
    house: 'Van je huis',
    mortgage: 'Van de hypotheek van dit huis',
    portfolio: 'Van je beleggingen',
  },

  categories: {
    housing: 'Wonen',
    utilities: 'Energie & water',
    insurance: 'Verzekeringen',
    transport: 'Vervoer',
    health: 'Zorg',
    media: 'Media',
    other: 'Overig',
  },

  frequencies: {
    weekly: 'Elke week',
    monthly: 'Elke maand',
    quarterly: 'Elk kwartaal',
    halfYearly: 'Elk halfjaar',
    yearly: 'Elk jaar',
  },

  loanPartKinds: {
    annuity: 'Annuïteit',
    linear: 'Lineair',
    interestOnly: 'Aflossingsvrij',
  },

  transferTaxBands: {
    starter: 'Starter',
    ownHome: 'Eigen woning',
    other: 'Overig',
  },

  buyingCostLines: {
    notary: 'Notaris',
    valuation: 'Taxatie',
    mortgageAdvice: 'Hypotheekadvies',
    structuralSurvey: 'Bouwkundige keuring',
    buyingAgent: 'Aankoopmakelaar',
  },

  holdingKinds: {
    stock: 'Aandeel',
    etf: 'ETF',
  },

  transactionKinds: {
    buy: 'Aankoop',
    sell: 'Verkoop',
    dividend: 'Dividend',
    fee: 'Kosten',
    adjustment: 'Handmatige correctie',
  },

  disclaimer:
    'Schattingen op basis van wat je zelf invult. Gather is geen financieel adviseur.',

  actions: {
    add: 'Toevoegen',
    save: 'Opslaan',
    cancel: 'Annuleren',
    delete: 'Verwijderen',
    duplicate: 'Dupliceren',
    rename: 'Naam wijzigen',
    edit: 'Bewerken',
    done: 'Klaar',
    loading: 'Laden',
    refresh: 'Vernieuwen',
    retry: 'Opnieuw proberen',
  },

  errors: {
    amount: 'Vul een bedrag in.',
    name: 'Geef het een naam.',
    date: 'Kies een datum.',
    positive: 'Dat moet meer dan niets zijn.',
    percent: 'Vul een percentage tussen 0 en 100 in.',
    splitTotal: 'De verdeling moet samen 100 % zijn.',
    customTotal: 'De bedragen moeten samen het betaalde bedrag zijn.',
    units: 'Vul in hoeveel stuks.',
    confirmDelete: '{name} verwijderen?',
    confirmDeleteBody: 'Dit is definitief en kan niet ongedaan worden gemaakt.',
  },

  index: {
    title: 'Financiën',
    houses: 'Huizen',
    money: 'Geld',
    overviews: 'Overzichten',
    addHouse: 'Huis toevoegen',
    houseSummary: '{monthly} per maand · {parts}',
    houseNoMortgage: 'Nog geen hypotheekberekening',
    partCount: '{count} leningdelen',
    onePart: '1 leningdeel',
    recurring: 'Vaste lasten',
    recurringSummary: '{count} lasten · jouw deel {share}',
    recurringEmpty: 'Wat het huishouden elke maand betaalt',
    savings: 'Spaardoelen',
    savingsEmpty: 'Spaar samen ergens naartoe',
    savingsSummary: '{name} op koers voor {date}',
    split: 'Kosten delen',
    splitSummary: 'Wie wat schuldig is, eenmalig',
    portfolio: 'Beleggingen',
    portfolioEmpty: 'Nog geen beleggingen',
    netWorth: 'Vermogen',
    netWorthEmpty: 'Nog niets ingevuld',
    emptyTitle: 'Hier staat nog niets',
    emptyBody:
      'Voeg het huis toe waar je woont — of een huis waar je over nadenkt — en de hypotheek, de kosten koper en de waarde hangen eraan.',
  },

  house: {
    fallbackName: 'Het huis',
    newTitle: 'Huis toevoegen',
    newBody:
      'Eén veld. De rest — de waarde, de hypotheek, de kosten koper — komt later.',
    nameLabel: 'Hoe noem je het?',
    namePlaceholder: 'Kerkstraat 14',
    summaryCaption: 'Hypotheek, alle delen',
    summarySub: '{parts} · {outstanding} openstaand',
    noMortgage: 'Nog geen hypotheekberekening',
    firstFixEnds: 'Eerste rentevaste periode eindigt {date}',
    calculations: 'Hypotheekberekeningen',
    addCalculation: 'Berekening toevoegen',
    theHouse: 'Het huis',
    value: 'Wat het waard is',
    valueUnset: 'Nog niet ingevuld',
    valueSub: 'Jouw schatting · {date}',
    bought: 'Gekocht',
    boughtUnset: 'Niet gekocht',
    buyingCosts: 'Kosten koper',
    buyingCostsSub: '{cash} eigen geld nodig',
    buyingCostsUnset: 'Nog niet uitgerekend',
    notice:
      'Een huis dat je zelf hebt ingevoerd. Gather zoekt niets op en de waarde is wat je er als laatste in hebt gezet.',
    calculationNamePlaceholder: 'Wat we nu betalen',
    copySuffix: '{name} (kopie)',
  },

  mortgage: {
    parts: 'Leningdelen',
    addPart: 'Leningdeel toevoegen',
    noParts: 'Nog geen leningdelen',
    noPartsBody:
      'Een hypotheek bestaat hier uit haar delen. Voeg het eerste toe en de totalen volgen.',
    together: 'Alles bij elkaar',
    outstanding: 'Openstaand',
    interestToPay: 'Nog te betalen rente',
    lastPaidOff: 'Laatste deel afgelost',
    charges: 'Boeterente',
    whenFixesEnd: 'Wanneer de rentevaste periodes aflopen',
    stepsSummary: '{count} stappen, {from} tot {to}',
    oneStep: 'Er verandert niets',
    oneStepSub: 'Geen rentevaste periode loopt af zolang deze hypotheek loopt',
    barMonthly: '{amount} per maand',
    barSub: '{parts} · {outstanding} openstaand',
    notice:
      'Elk deel wordt apart berekend en de totalen zijn de som daarvan. De rentes na een rentevaste periode zijn de jouwe, geen voorspelling.',
    duplicateNotice:
      'Dupliceren laat deze berekening zoals hij is en geeft je een kopie om aan te passen.',
  },

  loanPart: {
    title: 'Deel {index}',
    kind: 'Hoe het wordt afgelost',
    amount: 'Bedrag',
    interest: 'Rente',
    fixedUntil: 'Rentevast tot',
    fixedUntilUnset: 'Variabel',
    remainingTerm: 'Resterende looptijd',
    years: '{years} jaar',
    months: '{months} maanden',
    whenFixEnds: 'Als deze rentevaste periode afloopt',
    ifRateBecomes: 'Als de rente wordt',
    addRate: 'Rente toevoegen',
    fromDate: 'Dit deel, vanaf {date}',
    repayments: 'Extra aflossingen',
    addRepayment: 'Aflossing toevoegen',
    repaymentOnce: 'Eenmalig',
    repaymentMonthly: 'Elke maand',
    onceSummary: '{amount} eenmalig',
    monthlySummary: '{amount} elke maand',
    fromMonth: 'vanaf {date}',
    charge: 'Boeterente',
    chargeUnset: 'Niet ingevuld',
    chargeSummary: '{free} % boetevrij per jaar, daarna {rate} %',
    freeAnnual: 'Boetevrij per jaar',
    chargeRate: 'Over de rest',
    barThisPart: 'dit deel',
    barAll: '{amount} voor de hele hypotheek',
    notice:
      'Een aflossing hoort bij het deel waarop je aflost, want dat is het deel waarvan je de rente bespaart.',
  },

  timeline: {
    title: 'Wanneer de rentevaste periodes aflopen',
    eachStep: 'Elke stap',
    today: 'Vandaag',
    todaySub: 'Elk deel op de huidige rente',
    refix: 'Deel {index} gaat naar {rate} % — jouw getal',
    paidOff: 'Deel {index} is afgelost',
    repayment: 'Een aflossing op deel {index} begint',
    steepest: 'De duurste maand is {month}, met {amount}.',
    steepestDelta: '{amount} meer dan nu.',
    steepestTail: 'Pas een rente op een deel aan en deze lijst beweegt mee.',
    notice:
      'Elke rente na een rentevaste periode is er een die je zelf op dat deel hebt ingevuld. Gather heeft geen mening over de rente.',
  },

  buyingCosts: {
    title: 'Kosten koper',
    purchase: 'De aankoop',
    price: 'Vraagprijs',
    ownMoney: 'Eigen geld',
    mortgage: 'Hypotheek',
    rateAndTerm: 'Rente · looptijd',
    transferTax: 'Overdrachtsbelasting',
    transferTaxLine: 'Overdrachtsbelasting',
    yourCosts: 'Kosten die je zelf betaalt',
    nhg: 'NHG',
    nhgOff: 'Uit',
    shortBy: 'Je komt tekort',
    spareBy: 'Je houdt over',
    shortBody:
      'Je eigen geld dekt {own} van de {needed} die nodig is. Dit is rekenwerk, geen oordeel over wat je kunt betalen.',
    barCash: 'eigen geld nodig',
    barMonthly: '{amount} per maand · annuïteit · {term}',
    notice:
      'Elk bedrag hierboven heb je zelf ingevuld. Controleer ze bij je notaris en geldverstrekker.',
    emptyBody:
      'Wat een aankoop aan eigen geld kost, bovenop de prijs. Alleen Nederland, en elk bedrag vul je zelf in.',
    start: 'De kosten uitrekenen',
  },

  recurringCosts: {
    title: 'Vaste lasten',
    household: 'Het huishouden',
    yourShare: 'Jouw deel',
    perMonth: 'Per maand',
    perYear: 'Per jaar',
    aMonth: 'per maand',
    aYear: 'per jaar',
    shareAverage: 'gemiddeld {percent} %',
    addCost: 'Vaste last toevoegen',
    emptyTitle: 'Nog geen vaste lasten',
    emptyBody:
      'Voeg toe wat het huishouden elke maand of elk jaar betaalt; Gather telt het op — meer niet. Geen vervaldatums, geen betalingen, geen herinneringen.',
    notice:
      'Totalen op basis van wat je zelf invult. Gather houdt geen betalingen of vervaldatums bij, en een deel is een verhouding, geen schuld.',
    cost: {
      theCost: 'De vaste last',
      amount: 'Bedrag',
      howOften: 'Hoe vaak',
      category: 'Categorie',
      note: 'Notitie',
      noteUnset: 'Niets opgeschreven',
      notePlaceholder: 'Verlengt in maart',
      whoPays: 'Wie betaalt wat',
      changeSplit: 'Verdeling wijzigen',
      splitEven: 'Gelijk verdelen',
      splitUnset: 'Niet verdeeld',
      namePlaceholder: 'Autoverzekering',
      notice:
        'Een deel is hoe jullie deze last onderling verdelen. Er loopt niets op en er wordt niets verrekend — daar is Kosten delen voor.',
      comparisonSoon: 'Vergelijken wat dit elders zou kosten komt later.',
    },
  },

  savings: {
    title: 'Spaardoelen',
    addGoal: 'Spaardoel toevoegen',
    emptyTitle: 'Nog geen spaardoelen',
    emptyBody:
      'Stel een bedrag en een datum in, vul in wat je opzij hebt gezet, en Gather zegt wat een maand moet zijn.',
    namePlaceholder: 'Nieuwe keuken',
    target: 'Doelbedrag',
    targetDate: 'Wanneer',
    ofTargetBy: 'van {target} vóór {date}',
    percentSaved: '{percent} % gespaard',
    toGo: 'nog {amount} te gaan',
    reached: 'Gehaald',
    whatItTakes: 'Wat ervoor nodig is',
    toMake: 'Om {date} te halen',
    monthsFromToday: '{count} maanden vanaf vandaag',
    thisMonthAlready: 'De datum is er',
    perMonth: '{amount} p/m',
    atPace: 'Met {amount} per maand',
    yourPace: 'Jullie huidige tempo',
    noPace: 'Vul in wat je opzij zet',
    progress: 'Voortgang',
    savedSoFar: 'Tot nu toe gespaard',
    puttingAside: 'Opzij per maand',
    puttingAsideSub: 'Wat jullie elke maand van plan zijn',
    updatedBy: 'Bijgewerkt op {date} door {name}',
    updateProgress: 'Voortgang bijwerken',
    behind: 'Achter op de streefdatum',
    notice:
      'Je vult zelf in wat je gespaard hebt. Gather leest dat niet van een rekening.',
  },

  split: {
    title: 'Kosten delen',
    what: 'Waarvoor was het',
    whatPlaceholder: 'Wintersport',
    whoPaid: 'Wie heeft betaald',
    addPayment: 'Betaling toevoegen',
    paymentFor: 'Waarvoor',
    splitBetween: 'Verdelen over',
    equally: 'Gelijk',
    custom: 'Zelf bepalen',
    toSettle: 'Verrekenen',
    pays: '{from} betaalt {to}',
    settled: 'Niets te verrekenen',
    barEach: 'per persoon',
    barSub: '{total} over {count} personen',
    saved: 'Bewaarde verdelingen',
    saveThis: 'Dit bewaren',
    saveName: 'Hoe noem je het',
    emptyTitle: 'Nog niets te verdelen',
    emptyBody:
      'Vul in wat ieder van jullie ergens aan betaald heeft; Gather zegt wie wie wat schuldig is. Er wordt niets bewaard tenzij je het opslaat.',
    immutable:
      'Een bewaarde verdeling houdt de getallen waarmee hij is gemaakt. Dupliceer hem om iets te wijzigen.',
    notice:
      'Gather bewaart dit niet. Verrekenen doen jullie onderling — geen saldo, geen historie.',
  },

  portfolio: {
    title: 'Beleggingen',
    totalValue: 'Totale waarde · {currency}',
    sinceYouBought: 'sinds aankoop',
    holdingCount: '{count} beleggingen',
    oneHolding: '1 belegging',
    addHolding: 'Belegging toevoegen',
    emptyTitle: 'Nog geen beleggingen',
    emptyBody:
      'Voeg een aandeel of ETF toe; Gather laat zien wat het waard is, met het tijdstip van de koers erbij.',
    informational: 'Ter informatie',
    realized: 'Gerealiseerde winst',
    dividends: 'Ontvangen dividend',
    fees: 'Betaalde kosten',
    pricesAt: 'Koersen {time}',
    fxAt: '{pair} {time}',
    stale: 'Kon nu niet vernieuwen. Trek omlaag om het opnieuw te proberen.',
    staleBadge: 'verouderd',
    notice:
      'Gemiddelde kostprijs, alleen ter informatie — geen belastingcijfers en geen advies. Trek omlaag om de koersen te vernieuwen.',
    unitsAt: '{units} stuks · {price}',
    holding: {
      listedOnly: 'Alleen beursgenoteerde aandelen en ETF’s',
      symbol: 'Ticker',
      name: 'Hoe het heet',
      exchange: 'Beurs',
      currency: 'Valuta',
      unitsHeld: 'Aantal stuks',
      averageCost: 'Gemiddelde kostprijs',
      onInvested: 'op {amount} ingelegd',
      since: 'Sinds {date}',
      openingPosition: 'Beginpositie',
      openingBody:
        'Wat je ook kiest, dit wordt een beginpositie waar je daarna aankopen, verkopen, dividend en kosten aan toevoegt.',
      knowWhatIHold: 'Ik weet wat ik heb',
      haveHistory: 'Ik heb mijn historie',
      units: 'Stuks',
      averagePrice: 'Gemiddelde prijs',
      asAt: 'Per',
      price: 'Koers',
      pricePerUnit: 'Prijs per stuk',
      perUnit: 'Per stuk',
      fee: 'Kosten',
      addTransaction: 'Transactie toevoegen',
      recordAdjustment: 'Correctie vastleggen',
      adjustmentBody:
        'Een split, een fusie of een wijziging in een ETF. Vul in wat je nu hebt en wat het gemiddeld gekost heeft; Gather verandert zelf niets.',
      adjustmentNote: 'Wat er gebeurd is',
      lastPrice: 'Laatst bekende koers',
      lastPriceHint: 'De koers die je als laatste invulde, en wanneer.',
      notice:
        'Splits, fusies en wijzigingen in een ETF vul je zelf in. Gather herschrijft een belegging nooit uit zichzelf.',
    },
  },

  netWorth: {
    title: 'Vermogen',
    today: 'Vandaag',
    sinceSnapshot: '{amount} meer dan je laatste momentopname op {date}',
    downSinceSnapshot: '{amount} minder dan je laatste momentopname op {date}',
    noSnapshot: 'Nog geen momentopname',
    assets: 'Bezittingen',
    liabilities: 'Schulden',
    addAsset: 'Bezitting toevoegen',
    addLiability: 'Schuld toevoegen',
    takeSnapshot: 'Momentopname maken',
    snapshots: 'Momentopnames',
    takenBy: 'Gemaakt door {name}',
    label: 'Wat is het',
    amount: 'Hoeveel',
    emptyTitle: 'Nog niets toegevoegd',
    emptyBody:
      'Vul in wat het huishouden bezit en schuldig is. Je huis en je beleggingen komen er vanzelf bij.',
    snapshotBody:
      'Een momentopname bevriest de cijfers van vandaag, inclusief het tijdstip van de koersen. Hij wordt daarna nooit meer aangepast.',
    notice:
      'De berekende regels komen van je huis en je beleggingen, niet van iets wat je hebt getypt. Een momentopname bevriest alles en wordt daarna nooit aangepast.',
  },
} satisfies typeof enFinances
