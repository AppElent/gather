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

/**
 * The Labels sheet's words that change with the list (APP-557): on a grocery
 * list the sheet is about an item. Removing a label everywhere reaches tasks
 * and items alike, so a grocery list says only "everywhere".
 */
export function labelsWords(t: Messages, grocery: boolean) {
  return grocery
    ? {
        onThis: t.tasks.grocery.labelsOnItem,
        removeEverywhere: t.tasks.grocery.removeLabelEverywhere,
      }
    : {
        onThis: t.tasks.task.labelsOnTask,
        removeEverywhere: t.tasks.task.removeLabelEverywhere,
      }
}
