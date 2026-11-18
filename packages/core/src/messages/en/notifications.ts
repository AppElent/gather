/**
 * What a push notification says under the record's title (APP-298). The
 * server renders it in the language of the phone that receives it, because
 * Language is a setting on the phone, not on the account. `{group}` is the
 * Group's name, so a person in two households knows which one it is about.
 */
export const notifications = {
  push: {
    taskReminder: 'Task reminder · {group}',
    taskAssignment: 'Assigned to you · {group}',
    eventReminder: 'Coming up · {group}',
    eventAssignment: 'You were added to this event · {group}',
  },
}
