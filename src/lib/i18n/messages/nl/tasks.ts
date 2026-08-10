import type { tasks as enTasks } from '../en/tasks'

export const tasks = {
  page: {
    subtitle:
      'Gedeelde lijsten — lokale staan hier, gekoppelde staan in Notion of Todoist.',
    addList: 'Lijst toevoegen',
    emptyTitle: 'Nog geen lijsten',
    emptyBody: 'Maak een lokale lijst, of koppel er een uit Notion of Todoist.',
    emptyAction: 'Voeg je eerste lijst toe',
    deleteListTitle: 'De lijst “{name}” verwijderen?',
    deleteListBody: 'De taken erin gaan mee, voor iedereen in deze Groep.',
    deleteListConfirm: 'Lijst verwijderen',
    deleteListFailed: 'Kon die lijst niet verwijderen.',
  },

  row: {
    toggle: '{task} afvinken',
    openInSource: '{task} openen in de app waar het vandaan komt',
  },

  local: {
    pill: 'Lokaal',
    deleteList: 'Lijst {name} verwijderen',
    quickAdd: 'Taak toevoegen…',
    newTaskIn: 'Nieuwe taak in {name}',
    addTask: 'Taak toevoegen',
    showDetails: 'Toevoegen met details…',
    hideDetails: 'Details verbergen',
    empty: 'Nog geen taken.',
    moveUp: '{task} omhoog',
    moveDown: '{task} omlaag',
    edit: '{task} bewerken',
    delete: '{task} verwijderen',
  },

  external: {
    refresh: '{name} vernieuwen',
    refreshing: 'Vernieuwen…',
    loadFailed: 'Kon deze lijst niet laden.',
    reconnect: 'De koppeling met {provider} moet opnieuw worden gelegd.',
    goToSettings: 'Naar de Groepsinstellingen',
    empty: 'Geen open taken in deze {provider}-lijst.',
    source: '{source} · {account}',
    sourceUnknownAccount: '{source} · losgekoppeld account',
    stale:
      'Kon {provider} niet bereiken. Dit zijn de taken die gather het laatst zag; ze zijn alleen-lezen totdat er weer antwoord komt.',
    reconnectStale:
      'De koppeling met {provider} voor deze lijst is losgekoppeld. Dit zijn de taken die gather het laatst zag; ze zijn alleen-lezen totdat de koppeling is hersteld.',
    unconfigured: 'Bij deze lijst ontbreken de koppelingsgegevens.',
    readOnlyProvider: 'Taken in deze lijst bewerk je in {provider}.',
    neverSynced: 'Deze lijst wordt uit {provider} geladen…',
    savedRemotely:
      'Opgeslagen in {provider}. Gather heeft het nog niet overgenomen.',
    refreshNow: 'Nu vernieuwen',
    writeFailed: 'Die wijziging is niet opgeslagen — hier is niets veranderd.',
  },

  subtasks: {
    add: 'Subtaak toevoegen aan {task}',
    newUnder: 'Nieuwe subtaak onder {task}',
    promote: '{task} uit de bovenliggende taak halen',
  },

  editor: {
    title: 'Taakomschrijving',
    dueDate: 'Datum',
    priority: 'Prioriteit',
    noPriority: 'Geen prioriteit',
    p1: 'P1 — dringend',
    p2: 'P2',
    p3: 'P3',
    p4: 'P4',
    labels: 'Labels',
    labelsPlaceholder: 'Labels, gescheiden door komma’s',
  },

  addList: {
    title: 'Een lijst toevoegen',
    local: 'Lokale lijst — hier gemaakt en bewerkt',
    mirror: 'Een lijst uit {provider} koppelen',
    connectFirst: 'Eerst {provider} koppelen…',
    listName: 'Lijstnaam',
    create: 'Aanmaken',
    failed: 'Er ging iets mis — probeer het opnieuw.',
    pickConnection: 'Welk {provider}-account?',
    connectAnother: 'Nog een {provider}-account koppelen…',
    pickNotion: 'Kies de Notion-database om te spiegelen:',
    pickTodoist: 'Kies het Todoist-project om te spiegelen:',
    nothingFoundNotion:
      'Niets gevonden — controleer of de koppeling toegang heeft tot minstens één database.',
    nothingFoundTodoist:
      'Niets gevonden — controleer of de koppeling toegang heeft tot minstens één project.',
  },

  notionMapping: {
    intro:
      'Koppel de eigenschappen van deze database, zodat gather weet hoe hij hem moet lezen. Een status-eigenschap telt als gedaan wanneer die Done, Complete of Completed heet.',
    notMapped: 'Niet gekoppeld',
    titleProperty: 'Titel-eigenschap',
    doneProperty: 'Gedaan-eigenschap (checkbox of status)',
    dueDateProperty: 'Datum-eigenschap',
    priorityProperty: 'Prioriteit-eigenschap (select met 1–4 of P1–P4)',
    labelsProperty: 'Labels-eigenschap',
    create: 'Gekoppelde lijst aanmaken',
  },
} satisfies typeof enTasks
