import type {
  byId as enById,
  groups as enGroups,
  modules as enModules,
} from '../en/modules'

export const byId = {
  recipes: {
    label: 'Recepten',
    description: 'Bewaar en beoordeel de gerechten die je kookt.',
  },
  nutrition: {
    label: 'Voeding',
    description: 'Houd bij wat je eet en volg je dagdoelen.',
  },
  'meal-planner': {
    label: 'Maaltijdplanner',
    description: 'Plan de maaltijden van de week.',
  },
  groceries: {
    label: 'Boodschappen',
    description: 'Een gedeelde boodschappenlijst die jullie samen afvinken.',
  },
  pantry: {
    label: 'Voorraadkast',
    description: 'Houd bij wat er thuis in voorraad is.',
  },
  finances: {
    label: 'Financiën',
    description: 'Budgetten en een overzicht van je uitgaven.',
  },
  bills: {
    label: 'Rekeningen & abonnementen',
    description: 'Terugkerende rekeningen en abonnementen.',
  },
  tasks: {
    label: 'Taken',
    description: 'Gedeelde takenlijsten.',
  },
  'baby-log': {
    label: 'Babylogboek',
    description: 'Temperatuur, voeding, slaap, groei en meer.',
  },
  calendar: {
    label: 'Agenda',
    description: 'Afspraken en herinneringen voor het huishouden.',
  },
  notes: {
    label: 'Notities',
    description: 'Snelle gedeelde notities.',
  },
  cheeses: {
    label: 'Kazen',
    description: 'Beoordeel de kazen die je proeft.',
  },
  wines: {
    label: 'Wijnen',
    description: 'Beoordeel de wijnen die je proeft.',
  },
  beers: {
    label: 'Bieren',
    description: 'Beoordeel de bieren die je proeft.',
  },
} satisfies typeof enById

export const groups = {
  kitchen: 'Keuken',
  money: 'Geld',
  home: 'Huis & leven',
  tasting: 'Proeven',
} satisfies typeof enGroups

export const modules = { byId, groups } satisfies typeof enModules
