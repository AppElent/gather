import type { notifications as enNotifications } from '../en/notifications'

export const notifications = {
  push: {
    taskReminder: 'Herinnering voor een taak · {group}',
    taskAssignment: 'Aan jou toegewezen · {group}',
    eventReminder: 'Komt eraan · {group}',
    eventAssignment: 'Je bent aan deze afspraak toegevoegd · {group}',
  },
} satisfies typeof enNotifications
