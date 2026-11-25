import type { notes as enNotes } from '../en/notes'

export const notes = {
  title: 'Notities',
  newNote: 'Nieuwe notitie',
  search: 'Notities doorzoeken',
  pinned: 'Vastgezet',
  recent: 'Recent',
  empty: 'Nog geen notities.',
  titlePlaceholder: 'Titel',
  bodyPlaceholder: 'Begin met schrijven',
  pin: 'Notitie vastzetten',
  unpin: 'Notitie losmaken',
  delete: 'Notitie verwijderen',
  length: '{count} van {max} tekens',
  refusals: {
    'notes:too-long':
      'Een notitie kan 100.000 tekens bevatten, inclusief de titel. Kort de notitie in om te bewaren.',
  },
} satisfies typeof enNotes
