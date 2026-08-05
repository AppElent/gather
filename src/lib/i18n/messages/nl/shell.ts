import type { shell as enShell } from '../en/shell'

export const shell = {
  topbar: {
    openNavigation: 'Navigatie openen',
    jumpTo: 'Ga naar',
    askGather: 'Vraag het Gather',
    reportIssue: 'Probleem melden',
    switchLanguage: 'Overschakelen naar {language}',
  },

  sidebar: {
    label: 'Gather-navigatie',
    primary: 'Hoofdnavigatie',
    footer: 'Instellingen en groepen',
    noGroup: 'Kies een Groep om de modules te zien.',
  },

  dock: {
    label: 'Mobiele navigatie',
  },

  drawer: {
    label: 'Navigatie',
    close: 'Navigatie sluiten',
  },

  palette: {
    placeholder: 'Ga naar…',
  },

  groupSwitcher: {
    label: 'Van Groep wisselen',
    none: 'Geen Groep',
    elsewhere: 'Ga terug',
    personal: 'Je eigen Groep',
    shared: 'Gedeelde Groep',
    pick: 'Kies een Groep',
    personalPill: 'Persoonlijk',
    manage: 'Groepen beheren',
  },

  marks: {
    soon: 'Binnenkort',
    onlyYou: 'Alleen jij',
    onlyYouExplained:
      'Alleen jij kunt dit zien. Het is in elke Groep hetzelfde.',
  },

  nav: {
    home: 'Start',
    all: 'Alles',
    groups: 'Groepen',
    settings: 'Instellingen',
    groupSettings: 'Groepsinstellingen',
  },

  routes: {
    home: {
      title: 'Start',
      subtitle: 'Wat je Groep heeft gedaan.',
    },
    all: {
      title: 'Alle modules',
      subtitle: 'Elke module in deze Groep. Zet vast wat je gebruikt.',
    },
    groupSettings: {
      title: 'Groepsinstellingen',
      subtitle: 'Instellingen die iedereen in deze Groep deelt.',
    },
    groups: {
      title: 'Groepen',
      subtitle: 'Beheer delen en leden.',
    },
    settings: {
      title: 'Instellingen',
      subtitle: 'Stel weergave en voorkeuren in.',
    },
    account: {
      title: 'Account',
      subtitle: 'Beheer je profiel en inloggegevens.',
    },
    fallback: {
      title: 'Gather',
      subtitle: 'Gedeelde plannen, modules en context.',
    },
  },

  allModules: {
    title: 'Alle modules',
    intro:
      'Elke module is beschikbaar in deze Groep. Een module vastzetten houdt hem hier in je eigen navigatie — niemand anders in de Groep ziet jouw keuzes, en je andere Groepen houden die van henzelf.',
    yourPins: 'Vastgezet',
    nothingPinned:
      'Niets vastgezet. Zet hieronder een module vast om hem in je navigatie te houden.',
    pin: 'Vastzetten',
    unpin: 'Losmaken',
    pinModule: '{module} vastzetten',
    unpinModule: '{module} losmaken',
    moveUp: '{module} omhoog',
    moveDown: '{module} omlaag',
  },

  placeholder: {
    planned: 'Module gepland',
    whatWillLiveHere: 'Wat hier komt',
    body: 'Deze module staat al in elke Groep, zodat navigatie, delen en de mobiele indeling klaar zijn voordat de rest gebouwd is.',
  },

  notFound: {
    eyebrow: 'Niet gevonden',
    title: 'Pagina niet gevonden',
    subtitle: 'Gather heeft geen pagina op dit adres.',
    signIn: 'Inloggen',
    body: 'De pagina is misschien verplaatst, of de link wijst naar een module die er nog niet is.',
    goHome: 'Naar Gather',
  },

  groupGate: {
    unknownTitle: 'Die Groep bestaat niet',
    unknownBody:
      'Er is hier niets dat “{slug}” heet. Controleer de link, of kies een Groep in de zijbalk.',
    forbiddenTitle: 'Deze Groep is niet van jou',
    forbiddenBody:
      'Je bent er geen lid van. Vraag een beheerder van de Groep om een uitnodiging.',
  },

  groups: {
    title: 'Groepen',
    intro:
      'De huishoudens waar je in zit. Open er een om de naam te wijzigen, de uitnodigingscode te delen of te vertrekken.',
    yours: 'Jouw Groepen',
    personal: 'Persoonlijk',
    createTitle: 'Nieuwe Groep',
    createBody: 'Een eigen huishouden. Je begint als beheerder.',
    createPlaceholder: 'bijv. Wijnclub',
    createLabel: 'Naam van de nieuwe Groep',
    create: 'Aanmaken',
    createFailed: 'Kon die Groep niet aanmaken.',
    joinTitle: 'Meedoen met een code',
    joinBody: 'Iemand in de Groep vindt hem bij de instellingen van die Groep.',
    joinPlaceholder: 'code van 8 tekens',
    joinLabel: 'Uitnodigingscode',
    join: 'Meedoen',
    joinFailed: 'Kon niet meedoen met die code.',
  },

  session: {
    stalledTitle: 'Inloggen kon niet worden afgerond',
    stalledBody:
      'Gather kon je sessie niet met de backend verbinden. Opnieuw laden helpt meestal.',
    reload: 'Opnieuw laden',
  },

  oauthCallback: {
    finishing: 'De koppeling wordt afgerond…',
    failedTitle: 'Koppelen mislukt',
    backToSettings: 'Terug naar instellingen',
    cancelled: 'De koppeling is geannuleerd of geweigerd.',
    invalid: 'Ongeldig antwoord — probeer opnieuw te koppelen.',
    noGroup:
      'Die koppeling kwam terug zonder Groep — begin opnieuw vanaf de instellingen van de Groep.',
    failed: 'Koppelen mislukt — probeer het opnieuw.',
  },

  about: {
    eyebrow: 'Over Gather',
    title: 'Eén gedeelde Groep voor het dagelijks regelwerk',
    subtitle:
      'Gather houdt gedeelde recepten, plannen, lijsten, taken, notities en proefnotities op één plek, voor de mensen die een huishouden delen.',
    modules:
      'Recepten en Voeding werken vandaag al, en de modules eromheen staan klaar zodat een Groep kan doorgroeien naar maaltijdplanning, boodschappen, voorraad, financiën, rekeningen, taken, agenda, notities, kazen en wijnen zonder van app te wisselen.',
    pins: 'Elke module is in elke Groep beschikbaar. Je zet de modules die je gebruikt vast in je eigen navigatie, de rest blijft één klik weg — je keuzes zijn alleen van jou en verplaatsen die van niemand anders.',
  },

  publicFrame: {
    brand: 'Gather',
    tagline: 'Samen je huishouden regelen',
  },

  gatherPanel: {
    title: 'Vraag het Gather',
    close: 'Vraag het Gather sluiten',
    context: 'Context: {page}',
    preview: 'Voorproefje',
    notConnected:
      'Automatisering is nog niet aangesloten. Gebruik dit paneel als kladblok voor de Groep waar je staat; echte acties volgen later.',
    tryAsking: 'Probeer eens',
    prompts: {
      recent: 'Laat zien wat er onlangs is veranderd',
      plan: 'Maak een plan voor deze Groep',
      summarize: 'Vat deze pagina samen',
    },
    placeholder: 'Vraag Gather om te helpen met deze Groep...',
  },

  issueReporter: {
    title: 'Probleem melden',
    types: {
      bug: 'Bug',
      enhancement: 'Verbetering',
      docs: 'Documentatie',
      question: 'Vraag',
    },
    placeholder: 'Wat ging er mis, of wat zou je graag willen zien?',
    send: 'Versturen',
    sending: 'Versturen…',
    filed: 'Bedankt — je melding is aangemaakt.',
    viewIssue: 'Melding bekijken',
    unreachable: 'Kon de server niet bereiken.',
  },

  home: {
    personalSubtitle: 'Je eigen Groep. Alles wat je hier bewaart is privé.',
    sharedSubtitle: 'Wat iedereen in deze Groep heeft gedaan.',
    whoIsHere: 'Wie er zijn',
    admin: 'Beheerder',
    personalNote: {
      before:
        '{group} is alleen van jou — niemand anders ziet wat je hier bewaart. Om iets met anderen te delen, begin je samen met hen een Groep bij',
      link: 'Groepen',
      after: '.',
    },
    sharedNote: {
      before:
        'Iedereen hier ziet alles in {group}. Om iemand uit te nodigen of te vertrekken, ga je naar',
      link: 'Groepen',
      after: '.',
    },
    recentActivity: 'Recente activiteit',
    nothingYet: 'Er is nog niets gebeurd in {group}.',
    nothingYetPersonal:
      'Alles wat je hier toevoegt komt in deze lijst, en alleen jij ziet het ooit.',
    nothingYetShared:
      'Alles wat iemand hier toevoegt komt in deze lijst, met zijn of haar naam erbij.',
  },

  activity: {
    unknownActor: 'Iemand',
    // The title lands after the verb, which English apposition handles ("added
    // the recipe X") and Dutch does not: "toevoegen" is separable, so the
    // straight translation strands "toe" in front of the title. A colon puts
    // the verb phrase back together and lets the title follow as a label.
    verbs: {
      recipe: 'voegde een recept toe:',
      task: 'voegde een taak toe:',
      babyEvent: 'noteerde',
    },
    connectors: {
      task: 'aan de lijst',
      babyEvent: 'voor',
    },
    justNow: 'Zojuist',
    minutesAgo: {
      one: '{count} minuut geleden',
      other: '{count} minuten geleden',
    },
    hoursAgo: { one: '{count} uur geleden', other: '{count} uur geleden' },
    yesterday: 'Gisteren',
    daysAgo: '{count} dagen geleden',
  },
} satisfies typeof enShell
