import type { settings as enSettings } from '../en/settings'

export const settings = {
  title: 'Instellingen',

  language: {
    title: 'Taal',
    description:
      'In welke taal Gather zelf staat. Wat jij en je Groepen hebben geschreven blijft in de taal waarin je het schreef.',
    names: {
      en: 'English',
      nl: 'Nederlands',
    },
  },

  appearance: {
    title: 'Weergave',
    description:
      'Kies hoe Gather eruitziet. Automatisch volgt de instelling van je systeem.',
    modes: {
      light: 'Licht',
      auto: 'Automatisch',
      dark: 'Donker',
    },
  },

  signedInDevices: {
    title: 'Ingelogde apparaten',
    description: 'Waar je bent ingelogd.',
    thisDevice: 'Dit apparaat',
    lastActive: 'Laatst actief {when}',
    unknownDevice: 'Onbekend apparaat',
    signOutOf: 'Uitloggen',
    revokeTitle: 'Uitloggen op {device}?',
    revokeBody: 'Dat apparaat moet opnieuw inloggen.',
    failed:
      'Je ingelogde apparaten konden niet worden geladen of gewijzigd. Probeer het opnieuw.',
  },

  dataExport: {
    title: 'Je gegevens exporteren',
    description:
      'Eén JSON-bestand met je account en alles in elke Groep waarvan je lid bent.',
    leftOut:
      'Andere leden staan er alleen met hun naam in: hun eigen gegevens en keuzes blijven van hen. Koppelingstokens en uitnodigingscodes worden weggelaten.',
    photos:
      'Foto’s staan erin als links, niet als bestanden. Iedereen aan wie je het bestand geeft, kan die links openen.',
    action: 'Exporteren',
    busy: 'Exporteren… {done} van {total}',
    failed: 'Je gegevens konden niet worden geëxporteerd. Probeer het opnieuw.',
    unavailable: 'Dit apparaat kan het bestand nergens heen delen.',
  },

  deleteAccount: {
    title: 'Account verwijderen',
    dangerZone: 'Gevarenzone',
    lead: 'Dit kan niet ongedaan worden gemaakt.',
    goesHeading: 'Verwijderd',
    goesBody:
      'Je bent het enige lid van deze Groepen, dus die verdwijnen, en alles erin verdwijnt mee.',
    keptHeading: 'Verlaten, niet verwijderd',
    keptBody:
      'Deze Groepen hebben andere leden. Jij ziet ze niet meer, en wat jij hebt toegevoegd blijft bij het huishouden.',
    noGroups: 'Je zit in geen enkele Groep.',
    choiceIntro:
      'Je logt in bij Gather met je AppElent-login, die Foundry, Fairway en Arcade Club ook gebruiken. Kies wat je verwijdert.',
    dataOnly: {
      title: 'Alleen Gather-gegevens verwijderen',
      body: 'Je Groepen worden verwijderd of verlaten zoals hierboven staat. Je AppElent-login blijft, dus Foundry, Fairway en Arcade Club blijven werken. Log je later opnieuw in bij Gather, dan begin je met een nieuw, leeg account.',
      submit: 'Gather-gegevens verwijderen',
      confirmTitle: 'Gather-gegevens van {email} verwijderen?',
      confirmBody:
        'Alles wat alleen jij in Gather kon zien wordt definitief verwijderd. Je AppElent-login blijft.',
      doneTitle: 'Je Gather-gegevens zijn verwijderd',
      doneBody:
        'Je bent op dit apparaat uitgelogd bij Gather. Je AppElent-login werkt nog steeds in Foundry, Fairway en Arcade Club.',
      failed:
        'Je Gather-gegevens konden niet worden verwijderd. Er is niets verwijderd.',
    },
    wholeAccount: {
      title: 'Mijn hele AppElent-account verwijderen',
      body: 'Verwijdert ook je AppElent-login, en daarmee je gegevens in Gather, Foundry, Fairway en Arcade Club. Je kunt bij geen van die apps meer inloggen.',
      submit: 'Mijn AppElent-account verwijderen',
      confirmTitle: 'AppElent-account {email} verwijderen?',
      confirmBody:
        'Je login en je gegevens in Gather, Foundry, Fairway en Arcade Club worden definitief verwijderd.',
    },
    confirmPhrase: 'VERWIJDER',
    confirmPhraseLabel: 'Typ {phrase} om te bevestigen',
    partlyFailed:
      'Je gegevens zijn verwijderd, maar het account zelf niet. Probeer het opnieuw, of neem contact op met support als het blijft mislukken.',
    underway: 'Je account wordt verwijderd…',
    unavailable:
      'Dit account kan hier niet worden verwijderd. Neem contact op met support.',
    signInCheckFailed:
      'Je aanmelding kon niet worden bevestigd, dus er is niets verwijderd. Probeer het opnieuw.',
    accountChanged:
      'Je bent nu bij een ander account ingelogd. Er is niets verwijderd.',
    failed: 'Je account kon niet worden verwijderd. Er is niets verwijderd.',
    apple: {
      prompt:
        'Je hebt je aangemeld met Apple. Ga nog één keer verder met Apple, zodat Apple je gegevens niet meer deelt; daarna wordt je account verwijderd. Tot dan wordt er niets verwijderd.',
      continue: 'Doorgaan met Apple',
      waiting: 'Wachten op Apple…',
      popupBlocked:
        'Je browser blokkeerde het Apple-venster, dus er is niets verwijderd. Sta pop-ups toe voor deze site en probeer het opnieuw.',
      appleMismatch:
        'Dat Apple-account is niet het account dat aan dit account is gekoppeld, dus er is niets verwijderd. Probeer het opnieuw en meld je aan met het Apple-account dat je voor AppElent gebruikt.',
      failed:
        'Het Apple-venster werd niet afgerond, dus er is niets verwijderd. Probeer het opnieuw.',
    },
  },

  groupSettings: {
    title: 'Groepsinstellingen',
    description:
      'Koppelingen met Notion en Todoist horen bij een Groep, niet bij jou — elk lid van die Groep kan er een gebruiken, en niemand daarbuiten. Elke Groep heeft die van zichzelf.',
    open: 'Instellingen',
  },

  groupPage: {
    title: 'Instellingen van {group}',
    intro:
      'Instellingen die iedereen in deze Groep deelt. Je eigen weergave- en accountinstellingen staan bij Instellingen, en zijn in elke Groep hetzelfde.',
  },

  connections: {
    title: 'Koppelingen',
    intro:
      'Koppel een externe app aan {group}. Elk lid van {group} kan hem gebruiken — Taken kan er een lijst uit spiegelen — en niemand daarbuiten.',
    notConnected: 'Niet gekoppeld',
    connectedBy: '{account} — gekoppeld door {name}',
    connect: 'Koppelen',
    opening: 'Openen…',
    disconnect: 'Ontkoppelen',
    disconnectTitle: '{provider} loskoppelen van {group}?',
    disconnectBody:
      'Gekoppelde lijsten laden niet meer totdat de koppeling is hersteld.',
    disconnectFailed: 'Kon {provider} niet loskoppelen.',
    startFailed: 'Kon de koppeling niet starten — probeer het opnieuw.',
  },

  group: {
    title: 'Deze Groep',
    sharedNote:
      'De naam, de code waarmee iemand binnenkomt, en de weg naar buiten.',
    name: 'Naam',
    rename: 'Hernoemen',
    renameFailed: 'Kon deze Groep niet hernoemen.',
    timeZone: 'Tijdzone',
    timeZoneNote:
      'Bepaalt welke dag het is voor iedereen in deze Groep, bijvoorbeeld bij de weekboodschappen. Zonder tijdzone gebruikt elk apparaat zijn eigen.',
    timeZoneUnset: 'Eigen tijdzone per apparaat (hier {zone})',
    timeZoneUseDevice: 'Tijdzone van dit apparaat gebruiken',
    timeZoneClear: 'Eigen tijdzone per apparaat gebruiken',
    timeZoneFailed: 'Kon de tijdzone niet wijzigen.',
    timeZoneAdminOnly: 'Alleen een beheerder kan dit wijzigen.',
    inviteCode: 'Uitnodigingscode',
    inviteCodeNote:
      'Iedereen met deze code kan zich aanmelden via Groepen — deel hem alleen met mensen die je erbij wilt hebben.',
    inviteCodeFailed: 'Kon de uitnodigingscode niet laden.',
    leave: 'Vertrekken',
    leaveButton: 'Deze Groep verlaten',
    leaveTitle: '{group} verlaten?',
    leaveBody:
      'Je ziet dan niets meer van wat erin zit. Wat je hebt toegevoegd blijft bij de Groep.',
    leaveConfirm: 'Groep verlaten',
    leaveFailed: 'Kon deze Groep niet verlaten.',
    lastMember:
      'Je bent het laatste lid, dus je kunt de Groep niet verlaten. Verwijder hem in plaats daarvan.',
    delete: 'Verwijderen',
    deleteButton: 'Deze Groep verwijderen',
    deleteTitle: '{group} verwijderen?',
    deleteBody:
      'Alles erin wordt voorgoed verwijderd, samen met de Groep zelf. Dit kan niet ongedaan worden gemaakt.',
    deleteConfirm: 'Groep verwijderen',
    deleteFailed: 'Kon deze Groep niet verwijderen.',
    deleteOthersFirst:
      'Pas mogelijk als alle anderen de Groep hebben verlaten.',
  },

  members: {
    title: 'Leden',
    personalNote:
      'Beheerders kunnen deze Groep hernoemen, rollen wijzigen en hem verwijderen. Alle anderen kunnen alles erin gebruiken.',
    sharedNote:
      'Beheerders kunnen deze Groep hernoemen en rollen wijzigen. Iedereen hier kan alles erin gebruiken.',
    you: 'Jij',
    admin: 'Beheerder',
    lastAdmin: 'Een Groep heeft minstens één beheerder nodig',
    makeMember: 'Maak lid',
    makeAdmin: 'Maak beheerder',
    roleFailed: 'Kon die rol niet wijzigen.',
  },

  sampleData: {
    title: 'Voorbeeldgegevens',
    descriptionBefore:
      'Bouwt een voorbeeldhuishouden rond je account, met datums rond vandaag. Beide acties verwijderen dat huishouden volledig —',
    descriptionStrong: 'inclusief alles wat je er zelf in hebt gezet',
    descriptionAfter:
      ', zoals een taak op een voorbeeldlijst. Je eigen Groepen en je eigen recepten blijven ongemoeid, en je standaard-Groep wordt teruggezet. Niet beschikbaar in productie.',
    load: 'Voorbeeldgegevens laden',
    loading: 'Laden…',
    remove: 'Voorbeeldgegevens verwijderen',
    removing: 'Verwijderen…',
    confirmRemove:
      'Het voorbeeldhuishouden verwijderen, inclusief alles wat je er zelf in hebt gezet? Je eigen Groepen en recepten blijven ongemoeid.',
    loaded:
      '{recipes} recepten, {tasks} taken en {babyEvents} babynotities geladen in “{group}”.',
    removed: '{deleted} voorbeeldregels verwijderd.',
    removedWithOrphans: {
      one: '{deleted} voorbeeldregels verwijderd, plus {count} regel die je er zelf in had gezet.',
      other:
        '{deleted} voorbeeldregels verwijderd, plus {count} regels die je er zelf in had gezet.',
    },
    failed: 'Kon de seed niet uitvoeren — bekijk de logs.',
  },
} satisfies typeof enSettings
