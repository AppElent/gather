import type { auth as enAuth } from '../en/auth'

export const auth = {
  wait: 'Even geduld…',
  email: 'E-mail',
  password: 'Wachtwoord',
  code: 'Code',
  verificationCode: 'Verificatiecode',

  errors: {
    generic: 'Er ging iets mis. Probeer het opnieuw.',
    emailRequired: 'Vul eerst je e-mailadres in.',
    codeIncorrect:
      'Die code klopt niet. Controleer hem en probeer het opnieuw.',
    codeExpired:
      'Die code is verlopen of te vaak geprobeerd. Vraag een nieuwe aan.',
    rateLimited: 'Te veel pogingen. Wacht een minuut en probeer het opnieuw.',
    invalidVerification: 'Ongeldige of onvolledige verificatie.',
    needsExtraStep:
      'Voor dit account is een inlogstap nodig die dit formulier niet kan afronden.',
    noSecondFactor:
      'Voor dit account is geen ondersteunde verificatiemethode ingesteld.',
  },

  signIn: {
    eyebrow: 'Inloggen',
    title: 'Welkom terug',
    subtitle: 'Log in met je Gather-account om je Groepen te openen.',
    submit: 'Inloggen',
    forgotPassword: 'Wachtwoord vergeten?',
    createAccount: 'Account aanmaken',
    redirecting: {
      eyebrow: 'Ingelogd',
      title: 'Gather openen',
      subtitle: 'We brengen je naar je Groepen.',
      body: 'Doorsturen…',
    },
    emailCode: {
      send: 'Mail me een code',
      unavailable: 'Inlogcodes zijn niet beschikbaar voor dit account.',
      sent: 'We hebben een code van 6 cijfers gestuurd naar {email}.',
      resend: 'Stuur een nieuwe code',
      resendIn: 'Nieuwe code over {seconds}s',
      resent: 'Er is een nieuwe code onderweg.',
      back: 'Ander e-mailadres of wachtwoord gebruiken',
    },
    secondFactor: {
      totp: 'Vul de code uit je authenticator-app in.',
      backupCode: 'Vul een van je back-upcodes in.',
      sent: 'We hebben een code gestuurd naar {contact}.',
      sentFallback: 'je geverifieerde contactgegevens',
      backupCodeLabel: 'Back-upcode',
      verify: 'Verifiëren',
      back: 'Terug naar inloggen',
    },
  },

  signUp: {
    eyebrow: 'Account aanmaken',
    title: 'Begin met Gather',
    subtitle: 'Maak je account aan en start een Groep om te delen.',
    submit: 'Account aanmaken',
    haveAccount: 'Heb je al een account? Log in',
    codeSent: 'We hebben een code gestuurd naar {email}.',
    verify: 'Verifiëren',
  },

  forgotPassword: {
    eyebrow: 'Account herstellen',
    title: 'Wachtwoord opnieuw instellen',
    subtitle: 'Vraag een herstelcode aan en ga terug naar je Groepen.',
    sendCode: 'Code versturen',
    newPassword: 'Nieuw wachtwoord',
    submit: 'Wachtwoord opnieuw instellen',
    failed: 'Het wachtwoord kon niet opnieuw worden ingesteld.',
  },

  testLogin: {
    button: '▶ Dev: inloggen als testgebruiker',
    needsSteps: 'De testgebruiker heeft extra stappen nodig.',
  },
} satisfies typeof enAuth
