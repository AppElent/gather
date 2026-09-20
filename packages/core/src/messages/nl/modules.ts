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
  'recurring-costs': {
    label: 'Vaste lasten',
    description: 'Houd terugkerende kosten en ieders aandeel bij.',
  },
  'shared-costs': {
    label: 'Kosten delen',
    description: 'Verdeel de kosten van één gebeurtenis over groepsleden.',
  },
  'savings-goals': {
    label: 'Spaardoelen',
    description: 'Stel doelen en houd de voortgang handmatig bij.',
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
