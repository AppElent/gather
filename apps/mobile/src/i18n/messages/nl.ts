/**
 * Dutch. `satisfies typeof en` is what keeps this file honest about coverage —
 * a missing key fails `pnpm typecheck`. It cannot catch an empty string or a
 * dropped `{placeholder}`, which is what `__tests__/messages.test.ts` is for on
 * the web; the phone will want the same test once there is more than one
 * screen's worth of strings here.
 *
 * The shared strings (brand, the pitch, the Module names) are the web's own
 * Dutch, not a re-translation — see the glossary in ADR-0011. "Groep" is
 * capitalised because it is the product's noun, not the generic word.
 */

import { nl as coreNl } from '@gather/core/messages'
import type { en } from './en'

export const nl = {
  brand: coreNl.shell.publicFrame.brand,

  welcome: {
    tagline: coreNl.shell.publicFrame.tagline,
    title: coreNl.shell.about.title,
    subtitle: coreNl.shell.about.subtitle,
    catalogueHeading: 'Alles wat een Groep krijgt',
    signIn: 'Inloggen',
    createAccount: 'Account aanmaken',
    devSignIn: 'Inloggen als testgebruiker',
    devBadge: 'Testversie',
  },

  modules: coreNl.modules,

  baby: coreNl.baby,

  recipes: coreNl.recipes,

  nutrients: coreNl.nutrients,

  tastings: coreNl.tastings,

  shell: {
    tabs: {
      home: coreNl.shell.nav.home,
      search: 'Zoeken',
      add: 'Toevoegen',
      settings: coreNl.shell.nav.settings,
      all: coreNl.shell.nav.all,
    },

    add: {
      title: 'Toevoegen aan {group}',
      workingOnly: 'Alleen acties die vandaag werken.',
      close: 'Sluiten',
      back: 'Terug naar acties',
      save: '{noun} opslaan',
      saved: 'Toegevoegd: {items}',
      sheetHint:
        'Opslaan houdt je in {group}. Met de pijl terug ga je naar de andere acties.',
      kinds: {
        row: 'in de rij',
        sheet: 'in het blad',
        handoff: 'opent een formulier',
        compose: 'kies en beoordeel',
      },
      actions: {
        'cheese-tasting': {
          label: coreNl.tastings.kinds.cheese.launcher,
          module: coreNl.modules.byId.cheeses.label,
          fields: [],
          noun: coreNl.tastings.kinds.cheese.one,
        },
        'wine-tasting': {
          label: coreNl.tastings.kinds.wine.launcher,
          module: coreNl.modules.byId.wines.label,
          fields: [],
          noun: coreNl.tastings.kinds.wine.one,
        },
        'beer-tasting': {
          label: coreNl.tastings.kinds.beer.launcher,
          module: coreNl.modules.byId.beers.label,
          fields: [],
          noun: coreNl.tastings.kinds.beer.one,
        },
        'task-new': {
          label: 'Taak toevoegen',
          module: coreNl.modules.byId.tasks.label,
          fields: ['Wat moet er gebeuren?'],
          noun: 'taak',
        },
        'recipe-import': {
          label: 'Importeren vanaf een link',
          module: coreNl.modules.byId.recipes.label,
          fields: [],
          noun: 'import',
        },
        'meal-log': {
          label: 'Maaltijd loggen',
          module: coreNl.modules.byId.nutrition.label,
          fields: ['Voedingsmiddel', 'Hoeveel?'],
          noun: 'maaltijd',
        },
        'food-scan': {
          label: 'Barcode scannen',
          module: coreNl.modules.byId.nutrition.label,
          fields: [],
          noun: 'voedingsmiddel',
        },
      },
      create: {
        title: 'Maken',
        description:
          'Dit is een tijdelijke vervanger voor het volledige moduleformulier. Er wordt niets opgeslagen.',
        fields: ['Naam', 'Notities', 'Tags'],
        save: 'Opslaan',
        saved: 'Er is niets opgeslagen — dit is een demostroom.',
      },
    },

    search: {
      title: 'Zoeken',
      deferred:
        'Zoeken wordt ontworpen rond de gegevens die het veilig kan vinden.',
    },

    home: {
      switchFrom: 'Groep: {group}. {action}',
      intro:
        'Welkom bij Gather. Je vindt alle modules voor deze Groep bij Alles.',
      personalSubtitle: coreNl.shell.home.personalSubtitle,
      sharedSubtitle: coreNl.shell.home.sharedSubtitle,
    },

    all: coreNl.shell.allModules,

    placeholder: coreNl.shell.placeholder,

    switcher: {
      action: coreNl.shell.groupSwitcher.label,
      title: coreNl.shell.groupSwitcher.pick,
      personal: coreNl.shell.groupSwitcher.personalPill,
      shared: coreNl.shell.groupSwitcher.shared,
      current: 'Huidige Groep',
    },

    groups: {
      ...coreNl.shell.groups,
      intro:
        'De huishoudens waar je in zit. Op Home wissel je tussen Groepen; hieronder begin je er een of doe je mee met die van iemand anders.',
    },

    openSettings: coreNl.shell.nav.settings,
  },

  settings: {
    title: coreNl.settings.title,

    language: coreNl.settings.language,

    appearance: {
      title: 'Weergave',
      description:
        'Hoe Gather er op deze telefoon uitziet. Dit wordt hier onthouden en niet bij je account, dus het is in elke Groep hetzelfde en gaat niet mee naar een ander apparaat.',
      // "Systeem" is what iOS and Android both call it in their own Dutch, so
      // it is the word somebody has already read on the setting this follows.
      modes: {
        light: 'Licht',
        system: 'Systeem',
        dark: 'Donker',
      },
      choose: 'Weergave: {mode}',
    },

    account: coreNl.shell.routes.account.title,
    groups: coreNl.shell.groups.title,

    sections: {
      account: coreNl.shell.routes.account.title,
      phone: 'Op deze telefoon',
      modules: 'Modules',
    },

    search: {
      placeholder: 'Instellingen zoeken',
      empty: 'Niets dat “{query}” heet.',
    },

    identity: 'Account: {name}',
  },

  account: {
    title: coreNl.shell.routes.account.title,
    managedOnWeb:
      'Je naam, e-mailadres en wachtwoord beheer je in Gather op het web.',
  },

  kitchen: {
    add: 'Toevoegen',
    name: 'Naam',
    quantity: 'Hoeveelheid (optioneel)',
    prepMinutes: 'Bereidingstijd in minuten',
    noMeals:
      'Nog geen maaltijden. Voeg een snelle maaltijd toe of gebruik een recept.',
    noPantry: 'Nog niets in de voorraadkast.',
    noCalendars: 'Nog geen agendaâ€™s.',
    noEvents: 'Geen afspraken deze maand.',
    chooseList: 'Boodschappenlijst kiezen',
    noGroceryList: 'Kies een takenlijst voor boodschappen.',
    quick: 'Snel onder {minutes} minuten',
    random: 'Willekeurige maaltijd',
    clearDinner: 'Maaltijd wissen',
    deleteTitle: 'â€œ{title}â€ verwijderen?',
    deleteBody: 'Dit kan niet ongedaan worden gemaakt.',
    newCalendar: 'Nieuwe agenda',
    newEvent: 'Nieuwe afspraak',
    eventDate: 'Datum (JJJJ-MM-DD)',
    startTime: 'Begin (UU:MM)',
    endTime: 'Einde (UU:MM)',
    visible: 'Agenda tonen',
    hidden: 'Agenda verbergen',
  },

  social: {
    heading: 'Of ga verder met',
    soon: 'Binnenkort',
    apple: 'Apple',
    microsoft: 'Microsoft',
    google: 'Google',
    unavailable: 'Verder met {provider} — binnenkort beschikbaar',
  },

  fields: {
    email: 'E-mailadres',
    password: 'Wachtwoord',
    newPassword: 'Nieuw wachtwoord',
    code: 'Code',
    showPassword: 'Wachtwoord tonen',
    hidePassword: 'Wachtwoord verbergen',
  },

  actions: {
    continue: 'Doorgaan',
    back: 'Terug',
    resend: 'Stuur opnieuw',
    save: 'Opslaan',
    close: 'Sluiten',
    cancel: 'Annuleren',
    delete: 'Verwijderen',
    edit: 'Bewerken',
    done: 'Klaar',
    completed: 'Voltooid ({count})',
    showCompleted: 'Voltooide taken tonen',
    hideCompleted: 'Voltooide taken verbergen',
    taskUpdateFailed:
      'Die taak kon niet worden bijgewerkt. Probeer het opnieuw.',
    reorder: 'Volgorde wijzigen',
    hide: 'Verbergen',
    showAll: 'Alles tonen',
    loading: 'Laden',
  },

  signIn: {
    title: 'Inloggen',
    heading: 'Welkom terug',
    submit: 'Inloggen',
    forgot: 'Wachtwoord vergeten?',
    noAccount: 'Nog geen account?',
    createOne: 'Maak er een aan',
  },

  signUp: {
    title: 'Account aanmaken',
    heading: 'Maak je account aan',
    subtitle: 'Je krijgt een code per e-mail om het adres te bevestigen.',
    submit: 'Account aanmaken',
    haveAccount: 'Heb je al een account?',
    signIn: 'Inloggen',
  },

  verify: {
    title: 'Bevestig je e-mailadres',
    heading: 'Kijk in je e-mail',
    subtitle: 'We hebben een code van zes cijfers naar {email} gestuurd.',
    submit: 'Bevestigen',
    resent: 'Verstuurd — kijk opnieuw in je e-mail.',
  },

  reset: {
    request: {
      title: 'Wachtwoord opnieuw instellen',
      heading: 'Wachtwoord opnieuw instellen',
      subtitle:
        'Geef het adres waarmee je je hebt aangemeld, dan sturen we een code.',
      submit: 'Stuur de code',
    },
    code: {
      title: 'Vul de code in',
      heading: 'Kijk in je e-mail',
      subtitle: 'We hebben een code van zes cijfers naar {email} gestuurd.',
      submit: 'Doorgaan',
    },
    password: {
      title: 'Kies een wachtwoord',
      heading: 'Kies een nieuw wachtwoord',
      subtitle: 'Neem iets dat je hier nog niet eerder hebt gebruikt.',
      submit: 'Opslaan en inloggen',
    },
  },

  gate: {
    title: 'Gather is niet beschikbaar',
    offline: 'Nog steeds bezig Gather te bereiken. Controleer je verbinding.',
    connectionLost:
      'Verbinding verbroken. Gather probeert opnieuw te verbinden.',
    retry: 'Probeer opnieuw',
  },

  group: {
    loading: coreNl.common.errors.loading,
    noneTitle: 'Je zit nog niet in een Groep',
    noneBody:
      'Gather maakt bij je eerste keer inloggen een persoonlijke Groep voor je. Blijft dit staan, begin er dan hieronder een of doe mee met die van iemand anders met hun uitnodigingscode.',
  },

  signedIn: {
    as: 'Ingelogd als {email}',
    signOut: 'Uitloggen',
  },

  errors: {
    generic: 'Er ging iets mis. Probeer het opnieuw.',
    network: 'Geen verbinding. Controleer je netwerk en probeer het opnieuw.',
    identifierNotFound: 'We konden geen account met dat e-mailadres vinden.',
    passwordIncorrect: 'Dat wachtwoord klopt niet.',
    passwordDoesNotMeetRequirements:
      'Dat wachtwoord voldoet niet aan de vereisten.',
    identifierExists: 'Er bestaat al een account met dat e-mailadres.',
    emailInvalid: 'Dat lijkt geen e-mailadres te zijn.',
    passwordTooShort: 'Een wachtwoord heeft minstens acht tekens nodig.',
    passwordPwned:
      'Dat wachtwoord is opgedoken in een datalek. Kies er een andere.',
    codeIncorrect: 'Die code klopt niet.',
    codeExpired: 'Die code is verlopen. Vraag een nieuwe aan.',
    required: 'Dit mag niet leeg zijn.',
    tooManyRequests: 'Te veel pogingen. Wacht even en probeer het opnieuw.',
  },

  // "Labs" blijft onvertaald: het is de naam van de sectie, niet een woord.
  labs: {
    title: 'Labs',
    description:
      'Prototypes van schermen waarover nog beslist wordt. Alleen in ontwikkelbuilds.',
    banner:
      'Prototype. De gegevens zijn verzonnen en blijven alleen in deze sessie.',
    reset: 'Opnieuw beginnen met verse gegevens',

    entries: {
      tasks: 'Taken — lijsten, één lijst, een taak',
      editModes: 'Een taak bewerken — drie manieren',
      notes: 'Notities',
    },

    tasks: {
      title: 'Taken',
      today: 'Vandaag',
      todayEmpty: 'Niets wat vandaag af moet.',
      lists: 'Lijsten',
      open: '{count} open',
      openOne: '1 open',
      allDone: 'Alles af',
      linked: 'Gekoppeld',
      inList: 'in {list}',
    },

    list: {
      addTask: 'Taak toevoegen…',
      empty: 'Nog niets op deze lijst.',
      display: 'Op elke regel tonen',
      dueDates: 'Einddatums',
      priority: 'Prioriteit',
      labels: 'Labels',
      rename: 'Lijst hernoemen',
      deleteList: 'Lijst verwijderen',
      reorderHint:
        'Sleep om te ordenen. Afvinken, bewerken en vegen staan uit tot je op Klaar tikt.',
      reorderCompleted: 'Afgeronde taken zijn verborgen terwijl je ordent.',
      readOnly:
        'Deze lijst staat in {provider}. Gather kan hem lezen, maar er niet in schrijven — dus hier is geen invoerregel.',
      refreshed: 'Zojuist gesynchroniseerd',
      complete: 'Afvinken',
      uncomplete: 'Weer openzetten',
      renameTask: 'Hernoemen',
      dueDate: 'Einddatum',
      moveToList: 'Naar lijst verplaatsen…',
      deleteTitle: '“{title}” verwijderen?',
      deleteBody: 'Dit kan niet ongedaan worden gemaakt.',
    },

    task: {
      untitled: 'Nieuwe taak',
      titlePlaceholder: 'Wat moet er gebeuren?',
      due: 'Einddatum',
      priority: 'Prioriteit',
      labels: 'Labels',
      list: 'Lijst',
      notes: 'Notities',
      notesPlaceholder: 'Alles wat het opschrijven waard is',
      unset: 'Geen',
      autosaved: 'Wijzigingen worden meteen bewaard. Terug is klaar.',
      delete: 'Taak verwijderen',
      today: 'Vandaag',
      tomorrow: 'Morgen',
      weekend: 'Dit weekend',
      clear: 'Geen datum',
      priorities: {
        1: 'Dringend',
        2: 'Hoog',
        3: 'Normaal',
        4: 'Laag',
      },
      addLabel: 'Label toevoegen',
      labelsOnTask: 'Op deze taak',
      labelsInGroup: 'Gebruikt in dit huishouden',
      labelsNone: 'Nog geen labels.',
      removeLabel: '{label} verwijderen',
      renameLabelEverywhere: 'Overal hernoemen',
      removeLabelEverywhere: 'Van elke taak verwijderen',
      renamingLabel: '{label} hernoemen naar',
      renameLabelSave: 'Hernoemen',
      renameLabelCancel: 'Annuleren',
      labelCount: '{count} labels',
      previousMonth: 'Vorige maand',
      nextMonth: 'Volgende maand',
      overdue: 'Te laat',
    },

    editModes: {
      title: 'Een taak bewerken',
      intro:
        'Dezelfde taak, op drie manieren bewerkt. Probeer ze en zeg welke de Module moet krijgen.',
      detail: 'Een eigen scherm',
      detailWhy:
        'Alle eigenschappen op één scherm verderop. De meeste tikken om er te komen, de meeste ruimte als je er bent, en de enige die verder reikt dan vier eigenschappen.',
      inline: 'In de regel zelf',
      inlineWhy:
        'Tik op de titel en typ. Het snelst voor een typefout, en het kan nooit meer dan de titel bewerken.',
      sheet: 'Een venster over de lijst',
      sheetWhy:
        'Houd de regel vast, bewerk in een venster, blijf in de lijst. Je houdt je plek, maar het venster krijgt een scrollbalk zodra er eigenschappen bij komen.',
      subject: 'De taak',
      open: 'Probeer het',
    },

    notes: {
      title: 'Notities',
      search: 'Notities zoeken',
      pinned: 'Vastgezet',
      recent: 'Recent',
      empty: 'Nog geen notities.',
      noMatches: 'Niets dat “{query}” heet.',
      newNote: 'Nieuwe notitie',
      untitled: 'Notitie zonder titel',
      titlePlaceholder: 'Titel',
      bodyPlaceholder: 'Begin met schrijven…',
      editedBy: 'Bewerkt {when} door {name}',
      pin: 'Vastzetten',
      unpin: 'Losmaken',
      delete: 'Notitie verwijderen',
      deleteTitle: '“{title}” verwijderen?',
      formatting:
        'De opmaakbalk is getekend, niet aangesloten: dit prototype gaat over de vorm.',
    },
  },
} satisfies typeof en
