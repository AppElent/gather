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
      },
      actions: {
        'task-new': {
          label: 'Taak toevoegen',
          module: coreNl.modules.byId.tasks.label,
          fields: ['Wat moet er gebeuren?'],
          noun: 'taak',
        },
        'recipe-import': {
          label: 'Importeren vanaf een link',
          module: coreNl.modules.byId.recipes.label,
          fields: ['Plak een receptlink'],
          noun: 'import',
        },
        'meal-log': {
          label: 'Maaltijd loggen',
          module: coreNl.modules.byId.nutrition.label,
          fields: ['Voedingsmiddel', 'Hoeveel?'],
          noun: 'maaltijd',
        },
        'recipe-new': {
          label: 'Recept schrijven',
          module: coreNl.modules.byId.recipes.label,
          fields: [],
          noun: 'recept',
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
      personalSubtitle: coreNl.shell.home.personalSubtitle,
      sharedSubtitle: coreNl.shell.home.sharedSubtitle,
      pins: coreNl.shell.allModules.yourPins,
      nothingPinned: 'Nog niets vastgezet in deze Groep.',
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
} satisfies typeof en
