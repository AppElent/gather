/**
 * The words of the interactive views an agent shows through the MCP server
 * (`src/lib/mcp/views/`). They follow the host's language, not the app's
 * setting. Event titles, task titles and recipes are content.
 */
export const mcpViews = {
  common: {
    waiting: 'Loading…',
    error: 'Gather could not load this. Try again.',
    fullscreen: 'Full screen',
    exitFullscreen: 'Exit full screen',
    readOnly: 'This connection can only read Gather.',
  },
  agenda: {
    title: 'Week of {date}',
    thisWeek: 'This week',
    previous: 'Previous week',
    next: 'Next week',
    today: 'Today',
    allDay: 'All day',
    nothing: 'Nothing planned',
    truncated: 'Not every event fits here; ask for the full list.',
    count: { one: '{count} event', other: '{count} events' },
  },
  tasks: {
    open: { one: '{count} open', other: '{count} open' },
    empty: 'Nothing on this list yet.',
    allDone: 'All done.',
    showDone: 'Show done ({count})',
    hideDone: 'Hide done',
    add: 'Add',
    addPlaceholder: 'Add a task',
    due: 'Due {date}',
    overdue: 'Overdue · {date}',
    markDone: 'Mark “{title}” done',
    markOpen: 'Mark “{title}” open',
    saveFailed: 'That change was not saved. Try again.',
    external: 'This list lives in Notion or Todoist; change it there.',
    priority: { 1: 'Priority 1', 2: 'Priority 2', 3: 'Priority 3', 4: 'Priority 4' },
  },
  recipe: {
    ingredients: 'Ingredients',
    steps: 'Steps',
    servings: 'Servings',
    fewer: 'Fewer servings',
    more: 'More servings',
    scaled: 'Scaled from {count}',
    prep: '{minutes} min',
    source: 'Source',
    sharedFrom: 'From {group}',
    noIngredients: 'No ingredients listed.',
    noSteps: 'No steps listed.',
    rating: { one: '{count} star', other: '{count} stars' },
  },
}
