import type { Messages } from '../../i18n'

/**
 * The words on a task's own screen that change with the list it is on: a
 * grocery item is an item, not a task (APP-387). Everything else on the screen
 * reads the same for both.
 */
export function detailWords(t: Messages, grocery: boolean) {
  return grocery
    ? {
        titlePlaceholder: t.tasks.grocery.itemPlaceholder,
        delete: t.tasks.grocery.deleteItem,
      }
    : { titlePlaceholder: t.tasks.task.titlePlaceholder, delete: t.tasks.task.delete }
}
