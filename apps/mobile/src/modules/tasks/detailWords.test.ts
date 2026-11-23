import { expect, test } from 'vitest'

import { en } from '../../i18n/messages/en'
import { nl } from '../../i18n/messages/nl'
import { detailWords, labelsWords } from './detailWords'

test('a grocery item is an item, in both languages', () => {
  expect(detailWords(nl, true)).toEqual({
    titlePlaceholder: 'Wat heb je nodig?',
    delete: 'Item verwijderen',
  })
  expect(detailWords(en, true)).toEqual({
    titlePlaceholder: 'What do you need?',
    delete: 'Delete item',
  })
})

test('any other list keeps the task wording', () => {
  expect(detailWords(nl, false)).toEqual({
    titlePlaceholder: 'Wat moet er gebeuren?',
    delete: 'Taak verwijderen',
  })
  expect(detailWords(en, false).delete).toBe('Delete task')
})

test('the Labels sheet on a grocery item says item, in both languages', () => {
  expect(labelsWords(nl, true)).toEqual({
    onThis: 'Op dit item',
    removeEverywhere: 'Overal verwijderen',
  })
  expect(labelsWords(en, true)).toEqual({
    onThis: 'On this item',
    removeEverywhere: 'Remove everywhere',
  })
})

test('the Labels sheet on any other list keeps the task wording', () => {
  expect(labelsWords(nl, false)).toEqual({
    onThis: 'Op deze taak',
    removeEverywhere: 'Van elke taak verwijderen',
  })
  expect(labelsWords(en, false).onThis).toBe('On this task')
})

// APP-557's audit: the hold menu, the Move and Rename sheets and the rest of
// the Labels sheet are shared by tasks and grocery items, so none of their
// words may name a task. Sections are hidden on a grocery list.
test.each([
  ['nl', nl],
  ['en', en],
] as const)('the sheets a grocery item shares with tasks name no task (%s)', (_, m) => {
  const shared = [
    m.tasks.list.complete,
    m.tasks.list.uncomplete,
    m.tasks.list.renameTask,
    m.tasks.list.dueDate,
    m.tasks.list.priority,
    m.tasks.list.labels,
    m.tasks.list.moveToList,
    m.tasks.list.deleteTitle,
    m.tasks.list.deleteBody,
    m.actions.reorder,
    m.common.actions.delete,
    m.common.actions.save,
    m.tasks.task.due,
    m.tasks.task.priority,
    m.tasks.task.labels,
    m.tasks.task.labelsInGroup,
    m.tasks.task.labelsNone,
    m.tasks.task.removeLabel,
    m.tasks.task.renameLabelEverywhere,
    m.tasks.task.renamingLabel,
    m.tasks.task.addLabel,
    ...Object.values(labelsWords(m, true)),
  ]
  for (const words of shared) expect(words).not.toMatch(/taak|taken|task/i)
})
