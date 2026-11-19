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
  /**
   * A task someone else gave you (APP-302). The title of the push is the
   * Group's name; this is its body. `{date}` is the due day, `short` below.
   */
  taskAssigned: {
    undated: '{name} gave you a task: {title}',
    dated: '{name} gave you a task: {title}, {date}',
    someone: 'Someone',
  },
  /** A due day in a push, as `{weekday} {day} {month}`: "Sat 21 Nov". */
  short: {
    weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    months: [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ],
  },
}
