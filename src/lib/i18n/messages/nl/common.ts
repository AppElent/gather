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

  icon: {
    label: 'Icoon',
    hint: 'Wordt getoond als er geen foto van is.',
    choose: 'Icoon kiezen',
    change: 'Icoon wijzigen',
    none: 'Geen icoon',
  },

  image: {
    label: 'Foto',
    choose: 'Foto kiezen',
    replace: 'Andere foto kiezen',
    uploading: 'Uploaden…',
    failed: 'Kon die afbeelding niet uploaden',
    remove: 'Foto verwijderen',
    decodeFailed:
      'Die afbeelding kon in deze browser niet worden geopend. Sla hem op als JPEG en kies hem opnieuw.',
    prepareFailed:
      'Die afbeelding kon niet worden verwerkt. Probeer een kleinere foto, of sla hem op als JPEG en kies hem opnieuw.',
    frameTitle: 'Kies je uitsnede',
    frameFree:
      'Sleep het kader om het te verplaatsen, of sleep de hoek om het formaat te wijzigen. Gather bewaart wat erbinnen valt.',
    frameSquare:
      'Sleep het vierkant om het te verplaatsen, of sleep de hoek om het formaat te wijzigen. Gather bewaart wat erbinnen valt.',
    moveFrame: 'Kader verplaatsen',
    resizeFrame: 'Kader vergroten of verkleinen',
    frameSize: 'Kadergrootte',
    opening: 'Foto openen…',
    storedAs:
      'Wordt bewaard als {width} × {height} — de foto op je telefoon blijft zoals hij is.',
    use: 'Foto gebruiken',
    preparing: 'Verwerken…',
  },
} satisfies typeof enCommon
