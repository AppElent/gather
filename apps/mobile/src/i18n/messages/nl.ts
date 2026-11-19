/**
 * Dutch. `satisfies typeof en` is what keeps this file honest about coverage —
 * a missing key fails `pnpm typecheck`. It cannot catch an empty string or a
 * dropped `{placeholder}`.
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
  common: coreNl.common,

  baby: coreNl.baby,
  calendar: coreNl.calendar,

  recipes: coreNl.recipes,

  nutrients: coreNl.nutrients,

  tastings: coreNl.tastings,

  finances: coreNl.finances,

  loyaltyCards: {
    ...coreNl.loyaltyCards,
    scan: {
      title: 'Scan de kaart',
      hint: 'Houd de barcode van de kaart in het kader.',
      typeInstead: 'Typ het nummer',
      askTitle: 'Scan de kaart met de camera',
      askBody:
        'Gather gebruikt de camera alleen om de barcode van de kaart te lezen. Er wordt niets opgenomen of bewaard.',
      allow: 'Camera gebruiken',
      denied:
        'Gather mag de camera niet gebruiken. Zet het aan in Instellingen om te scannen, of typ het nummer.',
      openSettings: 'Open Instellingen',
      unavailable:
        'De camera is niet beschikbaar op dit apparaat. Typ het nummer.',
      scanned: '{format} gescand: {number}',
      scanAgain: 'Opnieuw scannen',
      suggestion: 'Dit lijkt een kaart van {store}.',
      useSuggestion: '{store} gebruiken',
      frame: 'Camerabeeld om een barcode te scannen',
    },
    till: {
      edit: 'Kaart bewerken',
      delete: 'Kaart verwijderen',
      front: 'Voorkant van de kaart van {store}',
      back: 'Achterkant van de kaart van {store}',
    },
    offline: {
      notice: 'Offline. Dit zijn je kaarten zoals ze op deze telefoon bewaard zijn.',
      back: 'Alle kaarten',
    },
    list: {
      /** When a card was last shown, in Home's activity words. */
      when: coreNl.shell.activity,
    },
    form: {
      ...coreNl.loyaltyCards.form,
      chooseFormat: 'Kies de soort barcode',
      takePhoto: 'Foto maken',
      choosePhoto: 'Foto kiezen',
      replacePhoto: 'Vervangen',
      removePhoto: 'Verwijderen',
      photoDenied:
        'Gather mag de camera of foto’s niet gebruiken. Zet het aan in Instellingen.',
      photoFailed: 'Die foto kon niet worden toegevoegd.',
      colors: {
        slate: 'Leisteen',
        red: 'Rood',
        orange: 'Oranje',
        yellow: 'Geel',
        green: 'Groen',
        teal: 'Blauwgroen',
        blue: 'Blauw',
        purple: 'Paars',
        pink: 'Roze',
        brown: 'Bruin',
      },
    },
  },

  search: {
    title: 'Zoeken',
    placeholder: 'Deze Groep doorzoeken',
    recent: 'Recent',
    clearRecent: 'Wissen',
    empty: 'Onlangs geopende items verschijnen hier.',
    noResults: 'Niets gevonden.',
    failed: 'Zoeken is nu niet beschikbaar.',
    clear: 'Zoeken wissen',
    types: {
      recipe: 'Recept',
      task: 'Taak',
      note: 'Notitie',
      tasting: 'Proeverij',
      calendarEvent: 'Afspraak',
      loyaltyCard: 'Klantkaart',
    },
    kinds: { cheese: 'Kaas', wine: 'Wijn', beer: 'Bier' },
  },

  shell: {
    tabs: {
      home: coreNl.shell.nav.home,
      search: 'Zoeken',
      add: 'Toevoegen',
      settings: coreNl.shell.nav.settings,
      all: coreNl.shell.nav.all,
    },

    homeScreenActions: {
      loyaltyCard: 'Klantkaart tonen',
      addTask: 'Taak toevoegen',
      quick: 'Snelle acties',
    },

    add: {
      title: 'Snel · {group}',
      subtitle: 'Tonen wat je nodig hebt, of iets toevoegen',
      back: 'Terug naar acties',
      saved: 'Toegevoegd: {items}',
      cards: {
        heading: coreNl.modules.byId['loyalty-cards'].label,
        all: 'Alle kaarten',
        show: '{store}, kaart tonen',
        emptyTitle: 'Nog geen klantkaarten',
        emptyBody: 'Scan er een, dan staat hij hier klaar voor de kassa.',
        scan: 'Scannen',
      },
      addHeading: 'Toevoegen',
      actions: {
        'cheese-tasting': {
          label: coreNl.tastings.kinds.cheese.launcher,
          short: 'Kaas proeven',
          module: coreNl.modules.byId.cheeses.label,
        },
        'wine-tasting': {
          label: coreNl.tastings.kinds.wine.launcher,
          short: 'Wijn proeven',
          module: coreNl.modules.byId.wines.label,
        },
        'beer-tasting': {
          label: coreNl.tastings.kinds.beer.launcher,
          short: 'Bier proeven',
          module: coreNl.modules.byId.beers.label,
        },
        'task-new': {
          label: 'Taak toevoegen',
          short: 'Taak',
          module: coreNl.modules.byId.tasks.label,
        },
        'recipe-import': {
          label: 'Importeren vanaf een link',
          short: 'Recept importeren',
          module: coreNl.modules.byId.recipes.label,
        },
        'loyalty-card-add': {
          label: 'Klantkaart toevoegen',
          short: 'Kaart scannen',
          module: coreNl.modules.byId['loyalty-cards'].label,
        },
      },
    },

    home: {
      switchFrom: 'Groep: {group}. {action}',
      today: coreNl.shell.today,
    },

    all: {
      ...coreNl.shell.allModules,
      categories: 'Categorieen',
      pinned: 'Vastgezet',
      hidden: 'Verborgen',
      hiddenCount: 'Verborgen ({count})',
      hide: 'Verbergen',
      show: 'Tonen',
      hideModule: '{module} verbergen',
      showModule: '{module} tonen',
      edit: 'Modules bewerken',
      done: 'Klaar',
      options: 'Weergaveopties',
      view: 'Weergave',
      viewList: 'Lijst',
      viewGrid: 'Tegels',
      collapse: '{section} inklappen',
      expand: '{section} uitklappen',
      reorderHint:
        'Sleep aan een greep om te herschikken. Een module blijft in zijn eigen categorie.',
      dragModule: '{module} herschikken',
      dragSection: '{section} herschikken',
    },

    placeholder: coreNl.shell.placeholder,

    switcher: {
      action: coreNl.shell.groupSwitcher.label,
      title: coreNl.shell.groupSwitcher.pick,
      shared: coreNl.shell.groupSwitcher.shared,
      current: 'Huidige Groep',
    },

    groups: {
      ...coreNl.shell.groups,
      intro:
        'De huishoudens waar je in zit. Op Home wissel je tussen Groepen. Hieronder nodig je iemand uit voor de huidige, begin je er een of doe je mee met die van iemand anders.',
      invite: {
        title: coreNl.settings.group.inviteCode,
        note: coreNl.settings.group.inviteCodeNote,
        share: 'Code delen',
        shareMessage:
          'Doe mee met {group} in Gather: kies onder Groepen voor ‘{join}’ en vul {code} in.',
      },
      leave: {
        button: coreNl.settings.group.leaveButton,
        title: coreNl.settings.group.leaveTitle,
        body: coreNl.settings.group.leaveBody,
        confirm: coreNl.settings.group.leaveConfirm,
        failed: coreNl.settings.group.leaveFailed,
        onlyAdmin:
          'Je bent de enige beheerder. Maak op het web eerst iemand anders beheerder in de instellingen van deze Groep, en vertrek dan.',
      },
      delete: {
        button: coreNl.settings.group.deleteButton,
        title: coreNl.settings.group.deleteTitle,
        body: coreNl.settings.group.deleteBody,
        confirm: coreNl.settings.group.deleteConfirm,
        failed: coreNl.settings.group.deleteFailed,
        othersFirst: coreNl.settings.group.deleteOthersFirst,
      },
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
      about: coreNl.shell.about.eyebrow,
    },

    /** Opens the web's statement in a browser; the words are the web's own. */
    privacy: coreNl.privacy.title,
    dataSources: coreNl.shell.about.dataSources.title,

    search: {
      placeholder: 'Instellingen zoeken',
      empty: 'Niets dat “{query}” heet.',
    },

    identity: 'Account: {name}',
  },

  account: {
    title: coreNl.shell.routes.account.title,
    name: 'Naam',
    password: 'Wachtwoord',
    email: 'E-mail',
    devices: 'Apparaten',

    dataExport: coreNl.settings.dataExport,

    editName: {
      title: 'Naam',
      description: 'Wat andere leden van je Groepen zien.',
      first: 'Voornaam',
      last: 'Achternaam',
    },

    changePassword: {
      title: 'Wachtwoord',
      description:
        'Als je het wijzigt, word je overal elders uitgelogd, op elke andere telefoon en browser.',
      current: 'Huidig wachtwoord',
      next: 'Nieuw wachtwoord',
      submit: 'Wachtwoord wijzigen',
      noPassword:
        'Je logt in zonder wachtwoord, dus er is er hier geen te wijzigen.',
    },

    emails: {
      title: 'E-mail',
      description: 'De adressen waarmee je kunt inloggen.',
      primary: 'Primair',
      unverified: 'Niet geverifieerd',
      addOnWeb:
        'Een adres toevoegen of verwijderen doe je in Gather op het web.',
    },

    sessions: {
      title: 'Apparaten',
      description: 'Waar je bent ingelogd.',
      thisDevice: 'Dit apparaat',
      lastActive: 'Laatst actief {when}',
      unknownDevice: 'Onbekend apparaat',
      signOutOf: 'Uitloggen',
      revokeTitle: 'Uitloggen op {device}?',
      revokeBody: 'Dat apparaat moet opnieuw inloggen.',
    },

    picture: {
      change: 'Foto wijzigen',
      take: 'Foto maken',
      choose: 'Foto kiezen',
      denied: 'Gather heeft toestemming nodig voor de camera of je foto’s.',
      failed: 'Die foto kon niet worden opgeslagen.',
    },

    deleteAccount: {
      title: 'Account verwijderen',
      lead: 'Dit kan niet ongedaan worden gemaakt.',
      goesHeading: 'Verdwijnt met je account',
      goesBody:
        'Je bent het enige lid van deze Groepen, dus die verdwijnen, en alles erin verdwijnt mee.',
      keptHeading: 'Verlaten, niet verwijderd',
      keptBody:
        'Deze Groepen hebben andere leden. Jij ziet ze niet meer, en wat jij hebt toegevoegd blijft bij het huishouden.',
      noGroups: 'Je zit in geen enkele Groep.',
      submit: 'Verwijder mijn account',
      confirmTitle: '{email} verwijderen?',
      confirmBody:
        'Je account en alles wat alleen jij kon zien wordt definitief verwijderd.',
      partlyFailed:
        'Je gegevens zijn verwijderd, maar het account zelf niet. Probeer het opnieuw, of neem contact op met support als het blijft mislukken.',
      underway: 'Je account wordt verwijderd…',
      unavailable:
        'Dit account kan niet vanuit de app worden verwijderd. Neem contact op met support.',
    },

    testAccount:
      'Dit is het gedeelde testaccount, dus het kan niet worden gewijzigd.',
  },

  kitchen: {
    name: 'Naam',
    quantity: 'Hoeveelheid (optioneel)',
    noPantry: 'Nog niets in de voorraadkast.',
    noGroceryList: 'Kies een takenlijst voor boodschappen.',
    changeList: 'Andere lijst gebruiken',
    addGroceryItem: 'Item toevoegen…',
    deleteTitle: '“{title}” verwijderen?',
    deleteBody: 'Dit kan niet ongedaan worden gemaakt.',
  },

  mealPlanner: {
    slots: { breakfast: 'Ontbijt', lunch: 'Lunch', dinner: 'Avondeten' },
    choose: {
      breakfast: 'Kies ontbijt',
      lunch: 'Kies lunch',
      dinner: 'Kies avondeten',
    },
    summary: {
      one: '{count} van 7 avonden gepland',
      other: '{count} van 7 avonden gepland',
    },
    people: { one: '{count} persoon', other: '{count} personen' },
    previousWeek: 'Vorige week',
    nextWeek: 'Volgende week',
    weekLabel: 'Week van {range}',
    more: 'Meer',
    preferences: 'Eetvoorkeuren',
    share: 'Deel weekmenu',
    groceries: 'Boodschappen',
    busyLabel: 'Drukke avond: {title} om {time}',
    allEating: { one: '{count} eet mee', other: 'Alle {count} eten mee' },
    eatingWithout: '{count} eten mee, zonder {names}',
    noneEating: 'Niemand eet mee',
    and: '{rest} en {last}',
    minutes: '{minutes} min',
    without: ', zonder {names}',
    dragHint:
      'Houd een maaltijd ingedrukt om hem naar een andere dag te slepen. Staat daar al iets, dan wisselen ze om.',
    dragLabel: 'Sleep {title} naar een andere dag',
    moved: '{title} staat nu op {day}.',
    swapped: '{title} is gewisseld met {other}.',
    failed: 'Dat lukte niet. Probeer het opnieuw.',
    removed: '{title} is uit het weekmenu gehaald.',
    undo: 'Ongedaan maken',
    shareTitle: 'Weekmenu {range}',
    shareEmpty: 'Nog niets gepland.',
    meal: {
      done: 'Klaar',
      recipe: 'recept',
      quickMeal: 'snel gerecht',
      whoEats: 'Wie eet mee',
      fromCalendar: 'Uit de agenda: {items}',
      calendarItem: '{name}, {title} {time}',
      servings: 'Porties',
      servingsFollow: 'Gelijk aan wie mee-eet',
      servingsAdjusted: 'Aangepast, wie mee-eet: {count}',
      fewer: 'Minder porties',
      moreServings: 'Meer porties',
      moveTo: 'Verplaatsen naar',
      hasMeal: '{day}, er staat al iets',
      swaps: 'Wisselt met {title} op {day}.',
      moves: '{title} gaat naar {day}. {weekday} wordt leeg.',
      note: 'Notitie',
      notePlaceholder: 'Bijvoorbeeld: maak extra voor de lunch',
      openRecipe: 'Recept openen',
      somethingElse: 'Iets anders',
      somethingElseSub: 'Kies een ander recept voor {weekday}',
      groceries: 'Boodschappen voor dit recept',
      groceriesAdded: {
        one: '{count} item op {list} gezet',
        other: '{count} items op {list} gezet',
      },
      groceriesNothing: 'Alles staat al op {list}',
      groceriesNoList: 'Kies eerst een boodschappenlijst in Boodschappen',
      remove: 'Uit weekmenu halen',
    },
    pick: {
      title: '{slot} {weekday}',
      search: { one: 'Zoek in {count} recept', other: 'Zoek in {count} recepten' },
      matches: 'Volgens voorkeuren',
      upTo: 'Tot {minutes} min',
      hidden: {
        one: '{count} recept verborgen door jullie voorkeuren ({reasons}). Tik Volgens voorkeuren om het te zien.',
        other:
          '{count} recepten verborgen door jullie voorkeuren ({reasons}). Tik Volgens voorkeuren om ze te zien.',
      },
      reasonTime: 'te lang voor {weekday}',
      reasonDislike: '{item}',
      clashTime: 'Duurt {minutes} min, langer dan {weekday} toelaat',
      clashDislike: 'Bevat {item}, staat bij liever niet',
      stars: '{rating} sterren',
      alreadyOn: 'Staat al op {day}',
      noMatches: 'Geen recept gevonden.',
      quickMeals: 'Snel gerecht zonder recept',
      quickMealsFooter: 'Een snel gerecht is avondeten zonder recept, zoals pizza of restjes.',
      newQuickMeal: 'Nieuw snel gerecht',
      quickName: 'Naam',
      quickMinutes: 'Minuten (optioneel)',
      save: 'Bewaar',
      edit: 'Wijzig',
      delete: 'Verwijder',
      deleteTitle: '“{title}” verwijderen?',
      deleteBody: 'Maaltijden die al gepland staan houden hun naam.',
    },
  },

  social: {
    // Apple's own Dutch button says "Ga door met Apple"; the rest follows it.
    heading: 'Of ga door met',
    apple: 'Ga door met Apple',
    microsoft: 'Ga door met Microsoft',
    incomplete:
      'Je account heeft nog een stap nodig die deze app nog niet ondersteunt. Rond die af op het web en log daarna hier in.',
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
    resend: 'Stuur opnieuw',
    done: 'Klaar',
    completed: 'Voltooid ({count})',
    showCompleted: 'Voltooide taken tonen',
    hideCompleted: 'Voltooide taken verbergen',
    taskUpdateFailed:
      'Die taak kon niet worden bijgewerkt. Probeer het opnieuw.',
    reorder: 'Volgorde wijzigen',
    hide: 'Verbergen',
    showAll: 'Alles tonen',
    showLess: 'Minder tonen',
    loading: 'Laden',
  },

  signIn: {
    heading: 'Welkom terug',
    submit: 'Inloggen',
    forgot: 'Wachtwoord vergeten?',
    noAccount: 'Nog geen account?',
    createOne: 'Maak er een aan',
    emailCode: {
      send: coreNl.auth.signIn.emailCode.send,
      sent: coreNl.auth.signIn.emailCode.sent,
      resend: coreNl.auth.signIn.emailCode.resend,
      resendIn: coreNl.auth.signIn.emailCode.resendIn,
      resent: coreNl.auth.signIn.emailCode.resent,
      back: coreNl.auth.signIn.emailCode.back,
      secondFactor: {
        heading: 'Nog één stap',
        totp: coreNl.auth.signIn.secondFactor.totp,
        backupCode: coreNl.auth.signIn.secondFactor.backupCode,
        sent: coreNl.auth.signIn.secondFactor.sent,
        sentFallback: coreNl.auth.signIn.secondFactor.sentFallback,
        backupCodeLabel: coreNl.auth.signIn.secondFactor.backupCodeLabel,
        verify: coreNl.auth.signIn.secondFactor.verify,
        back: coreNl.auth.signIn.secondFactor.back,
      },
    },
  },

  signUp: {
    heading: 'Maak je account aan',
    subtitle: 'Je krijgt een code per e-mail om het adres te bevestigen.',
    submit: 'Account aanmaken',
    haveAccount: 'Heb je al een account?',
    signIn: 'Inloggen',
  },

  verify: {
    heading: 'Kijk in je e-mail',
    subtitle: 'We hebben een code van zes cijfers naar {email} gestuurd.',
    resent: 'Verstuurd — kijk opnieuw in je e-mail.',
  },

  reset: {
    request: {
      heading: 'Wachtwoord opnieuw instellen',
      subtitle:
        'Geef het adres waarmee je je hebt aangemeld, dan sturen we een code.',
      submit: 'Stuur de code',
    },
    code: {
      heading: 'Kijk in je e-mail',
      subtitle: 'We hebben een code van zes cijfers naar {email} gestuurd.',
      submit: 'Doorgaan',
    },
    password: {
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
      'Maak hieronder een Groep aan of doe met een uitnodigingscode mee met die van iemand anders.',
  },

  session: {
    title: 'We konden je account niet bevestigen',
    body: 'Gather kon niet nagaan wie er is ingelogd. Probeer het opnieuw, of log uit en weer in.',
  },

  signedIn: {
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
    codeExpired: coreNl.auth.errors.codeExpired,
    emailCodeUnavailable: coreNl.auth.signIn.emailCode.unavailable,
    needsExtraStep: coreNl.auth.errors.needsExtraStep,
    noSecondFactor: coreNl.auth.errors.noSecondFactor,
    required: 'Dit mag niet leeg zijn.',
    tooManyRequests: 'Te veel pogingen. Wacht even en probeer het opnieuw.',
  },

  /** Zie `en.ts` voor waarom elke tekst hier staat. */
  drop: {
    title: 'Waar hoort dit?',
    savingTo: 'Opslaan in {group}',
    changeGroup: 'Wijzig',
    kinds: {
      url: 'Link',
      text: 'Tekst',
      image: 'Foto',
    },
    continue: 'Verder',
    cancel: 'Nu niet',
    targets: {
      'recipe-import': {
        label: 'Importeren als recept',
        detail: 'Gather leest de pagina en laat zien wat het vond',
      },
      'recipe-new-photo': {
        label: 'Recept beginnen met deze foto',
        detail: 'Een nieuw recept, met de foto er al op',
      },
      'recipe-photo': {
        label: 'Foto op een recept zetten',
        detail: 'Kies welk recept',
      },
      'note-new': {
        label: 'Bewaren als notitie',
        detail: 'Een nieuwe notitie',
      },
      'note-append': {
        label: 'Toevoegen aan een notitie',
        detail: 'Kies welke notitie',
      },
      'task-new': {
        label: 'Er een taak van maken',
        detail: 'Kies welke lijst',
      },
      'grocery-line': {
        label: 'Op de boodschappenlijst',
        detail: 'Direct op de boodschappenlijst van dit huishouden',
      },
      'baby-memory': {
        label: 'Bewaren als herinnering',
        detail: 'In het babylogboek',
      },
      'cheese-photo': {
        label: 'Foto op een kaas zetten',
        detail: 'Kies welke kaas',
      },
      'wine-photo': {
        label: 'Foto op een wijn zetten',
        detail: 'Kies welke wijn',
      },
      'beer-photo': {
        label: 'Foto op een bier zetten',
        detail: 'Kies welk bier',
      },
    },
    pick: {
      note: 'Welke notitie?',
      'task-list': 'Welke lijst?',
      recipe: 'Welk recept?',
      'tasting-subject': 'Welke?',
      search: 'Zoeken',
      empty: 'Hier staat nog niets.',
      noMatches: 'Niets met de naam “{query}”.',
      gone: 'Die deling wacht niet meer.',
      readOnly: 'Hier alleen-lezen',
    },
    replaceTitle: 'Foto op “{name}” vervangen?',
    replaceBody: 'De foto die er nu op staat wordt verwijderd.',
    replace: 'Vervangen',
    problems: {
      'no-child':
        'Voeg eerst een kind toe aan het babylogboek, dan kan dit daarheen.',
      'no-grocery-list':
        'Dit huishouden heeft nog geen boodschappenlijst gekozen. Kies er eerst een bij Boodschappen.',
    },
    failed:
      'Dat kon niet worden opgeslagen. Probeer opnieuw of kies iets anders.',
  },

  tasks: {
    count: coreNl.tasks.count,
    /** APP-306: the New list sheet, list kinds and their faces, shared with the web. */
    newList: coreNl.tasks.newList,
    appearance: coreNl.tasks.appearance,
    kinds: coreNl.tasks.kinds,
    icons: coreNl.tasks.icons,
    colors: coreNl.tasks.colors,
    starters: coreNl.tasks.starters,
    packing: coreNl.tasks.packing,
    wishlist: coreNl.tasks.wishlist,
    title: 'Taken',
    quickAdd: {
      list: 'Op de lijst',
      save: 'Taak toevoegen',
      noList:
        'Deze Groep heeft nog geen lijst waar Gather een taak aan kan toevoegen.',
      failed: 'Die taak kon niet worden toegevoegd. Probeer het opnieuw.',
    },
    today: 'Vandaag',
    todayEmpty: 'Niets wat vandaag af moet.',
    lists: 'Lijsten',
    open: '{count} open',
    openOne: '1 open',
    allDone: 'Alles af',
    linked: 'Gekoppeld',
    inList: 'in {list}',
    notLoaded: 'Niet geladen',

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
      loading: 'Laden uit {provider}…',
      reconnect:
        'Gather heeft geen verbinding meer met {provider}. Verbind opnieuw in Gather op het web en trek dan omlaag om te verversen.',
      failed:
        'Deze lijst kon niet uit {provider} worden geladen. Trek omlaag om het opnieuw te proberen.',
      complete: 'Afvinken',
      uncomplete: 'Weer openzetten',
      renameTask: 'Hernoemen',
      dueDate: 'Einddatum',
      moveToList: 'Naar lijst verplaatsen…',
      deleteTitle: '“{title}” verwijderen?',
      deleteBody: 'Dit kan niet ongedaan worden gemaakt.',
    },

    task: {
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
      previousMonth: 'Vorige maand',
      nextMonth: 'Volgende maand',
      overdue: 'Te laat',
    },
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
    editedByYou: 'Bewerkt {when} door jou',
    edited: 'Bewerkt {when}',
    pin: 'Vastzetten',
    unpin: 'Losmaken',
    delete: 'Notitie verwijderen',
    deleteTitle: '“{title}” verwijderen?',
    formatting:
      'De opmaakbalk is getekend, niet aangesloten: dit prototype gaat over de vorm.',
    today: 'Vandaag',
    deleteBody: 'Dit kan niet ongedaan worden gemaakt.',
  },

  notifications: {
    title: 'Meldingen',
    description:
      'Deze gaan mee met je account naar elke telefoon waarop je inlogt, en gelden in elke Groep.',
    tasks: 'Taken',
    calendar: 'Agenda',
    reminders: 'Herinneringen',
    assignments: 'Aan mij toegewezen',
    switchLabel: '{area}: {kind}',
    groups: 'Groepen',
    groupsDescription:
      'Een gedempte Groep stuurt je niets, wat er hierboven ook aanstaat.',
    muteLabel: 'Meldingen uit {group}',
    permission: {
      off: 'Meldingen staan uit voor Gather op deze telefoon.',
      allow: 'Meldingen aanzetten',
      denied:
        'Meldingen staan uit voor Gather in de iOS-instellingen, dus deze telefoon krijgt niets van het bovenstaande.',
      openSettings: 'iOS-instellingen openen',
      askTitle: 'Meldingen op deze telefoon?',
      ask: {
        reminder: 'Gather stuurt je herinnering als melding naar deze telefoon.',
        assignment:
          'Gather laat je op deze telefoon weten wanneer iemand je iets te doen geeft.',
      },
      notNow: 'Niet nu',
      continue: 'Doorgaan',
    },
    failed: 'Dat kon niet worden bewaard. Probeer het opnieuw.',
  },

  // "Labs" blijft onvertaald: het is de naam van de sectie, niet een woord.
  labs: {
    title: 'Labs',
    description:
      'Prototypes van schermen waarover nog beslist wordt. Alleen in ontwikkelbuilds.',

    finance: {
      title: 'Financieel lab',
      description:
        'Huizen en hypotheken, Portefeuille en Nettovermogen. Alleen in ontwikkelbuilds.',
      open: 'Financieel lab openen',
    },
  },
} satisfies typeof en
