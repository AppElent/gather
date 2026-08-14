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

  shell: {
    tabs: {
      home: coreNl.shell.nav.home,
      recipes: coreNl.modules.byId.recipes.label,
      tasks: coreNl.modules.byId.tasks.label,
      nutrition: coreNl.modules.byId.nutrition.label,
      all: coreNl.shell.nav.all,
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
    offline: 'Nog steeds bezig Gather te bereiken. Controleer je verbinding.',
  },

  group: {
    loading: coreNl.common.errors.loading,
    noneTitle: 'Je zit nog niet in een Groep',
    noneBody:
      'Gather maakt bij je eerste keer inloggen een persoonlijke Groep voor je. Blijft dit staan, open Gather dan op het web om er een aan te maken of aan mee te doen.',
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
