import type { notifications as enNotifications } from '../en/notifications'

export const notifications = {
  push: {
    taskReminder: 'Herinnering voor een taak · {group}',
    taskAssignment: 'Aan jou toegewezen · {group}',
    eventReminder: 'Komt eraan · {group}',
    eventAssignment: 'Je bent aan deze afspraak toegevoegd · {group}',
  },
  taskAssigned: {
    undated: '{name} gaf je een taak: {title}',
    dated: '{name} gaf je een taak: {title}, {date}',
    someone: 'Iemand',
  },
  short: {
    weekdays: ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'],
    months: [
      'jan',
      'feb',
      'mrt',
      'apr',
      'mei',
      'jun',
      'jul',
      'aug',
      'sep',
      'okt',
      'nov',
      'dec',
    ],
  },
} satisfies typeof enNotifications
