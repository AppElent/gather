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
} satisfies typeof enSettings
