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
    personalNote:
      'Je persoonlijke Groep. Die is alleen van jou, dus er valt hier niets te delen of te verlaten.',
    sharedNote:
      'De naam, de code waarmee iemand binnenkomt, en de weg naar buiten.',
    name: 'Naam',
    rename: 'Hernoemen',
    renameFailed: 'Kon deze Groep niet hernoemen.',
    addressChanges:
      'Het adres verandert mee met de naam, dus oude links naar deze Groep werken daarna niet meer.',
    inviteCode: 'Uitnodigingscode',
    inviteCodeNote:
      'Iedereen met deze code kan zich aanmelden via Groepen — deel hem alleen met mensen die je erbij wilt hebben.',
    leave: 'Vertrekken',
    leaveButton: 'Deze Groep verlaten',
    leaveTitle: '{group} verlaten?',
    leaveBody:
      'Je ziet dan niets meer van wat erin zit. Wat je hebt toegevoegd blijft bij de Groep.',
    leaveConfirm: 'Groep verlaten',
    leaveFailed: 'Kon deze Groep niet verlaten.',
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
      ', zoals een taak op een voorbeeldlijst. Je eigen Groepen, je voedingsdagboek en je eigen recepten blijven ongemoeid, en je standaard-Groep wordt teruggezet. Niet beschikbaar in productie.',
    load: 'Voorbeeldgegevens laden',
    loading: 'Laden…',
    remove: 'Voorbeeldgegevens verwijderen',
    removing: 'Verwijderen…',
    confirmRemove:
      'Het voorbeeldhuishouden verwijderen, inclusief alles wat je er zelf in hebt gezet? Je eigen Groepen, dagboek en recepten blijven ongemoeid.',
    loaded:
      '{recipes} recepten, {tasks} taken, {babyEvents} babynotities en {diaryEntries} dagboekregels geladen in “{group}”.',
    removed: '{deleted} voorbeeldregels verwijderd.',
    removedWithOrphans: {
      one: '{deleted} voorbeeldregels verwijderd, plus {count} regel die je er zelf in had gezet.',
      other:
        '{deleted} voorbeeldregels verwijderd, plus {count} regels die je er zelf in had gezet.',
    },
    failed: 'Kon de seed niet uitvoeren — bekijk de logs.',
  },
} satisfies typeof enSettings
