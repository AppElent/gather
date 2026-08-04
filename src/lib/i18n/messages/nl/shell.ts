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

  publicFrame: {
    brand: 'Gather',
    tagline: 'Samen je huishouden regelen',
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
