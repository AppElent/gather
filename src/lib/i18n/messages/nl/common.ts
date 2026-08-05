import type { common as enCommon } from '../en/common'

export const common = {
  actions: {
    start: 'Start',
    cancel: 'Annuleren',
    close: 'Sluiten',
    save: 'Opslaan',
    saving: 'Opslaan…',
    delete: 'Verwijderen',
    edit: 'Bewerken',
    add: 'Toevoegen',
    confirm: 'Bevestigen',
    working: 'Bezig…',
    copy: 'Kopiëren',
    copied: 'Gekopieerd!',
    retry: 'Opnieuw proberen',
    back: 'Terug',
  },
  errors: {
    somethingWentWrong: 'Er ging iets mis. Probeer het opnieuw.',
    notFound: 'Niet gevonden.',
    loading: 'Laden…',
    didNotWork: 'Dat lukte niet — probeer het opnieuw.',
  },

  image: {
    label: 'Foto',
    uploading: 'Uploaden…',
    failed: 'Kon die afbeelding niet uploaden',
    remove: 'Foto verwijderen',
  },
} satisfies typeof enCommon
