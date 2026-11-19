import type { GroceryAisle, GroceryUnit } from '../../groceries'
import type {
  TaskListColor,
  TaskListIcon,
  TaskListKind,
  TaskStarterKey,
  TaskStarterSectionKey,
} from '../../taskLists'

/**
 * The Tasks module's own words.
 *
 * A task's title, a list's name, and the labels a household invents are
 * content. So is anything mirrored from Notion or Todoist — those rows belong
 * to the other app, and gather only reads them.
 */
export const tasks = {
  /** The summary under a task screen's large title. */
  count: {
    open: { one: '{count} open', other: '{count} open' },
    lists: { one: '{count} list', other: '{count} lists' },
  },

  page: {
    subtitle:
      'Shared lists — local ones live here, linked ones mirror Notion or Todoist.',
    addList: 'Add list',
    emptyTitle: 'No lists yet',
    emptyBody: 'Create a local list, or link one from Notion or Todoist.',
    emptyAction: 'Add your first list',
    deleteListTitle: 'Delete the list “{name}”?',
    deleteListBody: 'Its tasks go with it, for everyone in this group.',
    deleteListConfirm: 'Delete list',
    deleteListFailed: 'Could not delete that list.',
  },

  row: {
    toggle: 'Toggle {task}',
    openInSource: 'Open {task} in its source app',
  },

  local: {
    pill: 'Local',
    deleteList: 'Delete list {name}',
    quickAdd: 'Add a task…',
    newTaskIn: 'New task in {name}',
    addTask: 'Add task',
    showDetails: 'Add with details…',
    hideDetails: 'Hide details',
    empty: 'No tasks yet.',
    moveUp: 'Move {task} up',
    moveDown: 'Move {task} down',
    edit: 'Edit {task}',
    delete: 'Delete {task}',
  },

  external: {
    refresh: 'Refresh {name}',
    loadFailed: 'Could not load this list.',
    reconnect: 'The {provider} connection needs to be reconnected.',
    goToSettings: 'Go to group settings',
    empty: 'No open tasks in this {provider} list.',
  },

  editor: {
    title: 'Task title',
    dueDate: 'Due date',
    priority: 'Priority',
    noPriority: 'No priority',
    p1: 'P1 — urgent',
    p2: 'P2',
    p3: 'P3',
    p4: 'P4',
    labels: 'Labels',
    labelsPlaceholder: 'Labels, comma-separated',
  },

  addList: {
    title: 'Add a list',
    local: 'Local list — created and edited here',
    mirror: '{provider} — read-only mirror',
    connectFirst: 'Connect {provider} first…',
    listName: 'List name',
    create: 'Create',
    failed: 'Something went wrong — try again.',
    pickNotion: 'Pick the Notion database to mirror:',
    pickTodoist: 'Pick the Todoist project to mirror:',
    nothingFoundNotion:
      'Nothing found — make sure the connection has access to at least one database.',
    nothingFoundTodoist:
      'Nothing found — make sure the connection has access to at least one project.',
  },

  notionMapping: {
    intro:
      'Map this database’s properties so gather knows how to read it. A status property counts as done when it is named Done, Complete, or Completed.',
    notMapped: 'Not mapped',
    titleProperty: 'Title property',
    doneProperty: 'Done property (checkbox or status)',
    dueDateProperty: 'Due date property',
    priorityProperty: 'Priority property (select named 1–4 or P1–P4)',
    labelsProperty: 'Labels property',
    create: 'Create linked list',
  },
  /**
   * The New list sheet (APP-306). Its kinds, icons and colours are keys in
   * `@gather/core/task-lists`; these are their words.
   */
  newList: {
    title: 'New list',
    create: 'Create',
    nameLabel: 'List name',
    kind: 'List type',
    color: 'Colour',
    icon: 'Icon',
    /** The icon that comes with the chosen type, always first in the row. */
    kindIcon: 'Icon of the type',
    failed: 'That list could not be made. Try again.',
  },

  /** A packing list: checked items stay in place, and can all be reset. */
  packing: {
    progress: '{done} of {total}',
    packed: 'packed',
    uncheckAll: 'Uncheck all',
    uncheckAllHint: 'For the next trip. The items stay.',
    undo: 'Undo',
    /** Read out after Uncheck all, beside the Undo button. */
    uncheckedAll: 'Everything is unchecked.',
  },

  /** A wishlist item's link and price (APP-306). */
  wishlist: {
    link: 'Link',
    linkPlaceholder: 'Paste a link',
    price: 'Price',
    pricePlaceholder: '0.00',
    openLink: 'Open link',
    invalidLink: 'That is not a web address.',
  },

  /**
   * A grocery item's amount and aisle (APP-309; `designs/groceries/README.md`,
   * "Recognition" and "Item sheet"). Unit ids are Dutch and fixed; these are
   * the words they are shown in.
   */
  grocery: {
    amount: 'Amount',
    decrease: 'Less',
    increase: 'More',
    clearAmount: 'No amount',
    unit: 'Unit',
    aisle: 'Aisle',
    /** Under the composer while a line is typed. */
    recognised: 'Recognised without AI, also offline',
    // The list in aisle sections, the Checked row and Recent (APP-310;
    // `designs/groceries/README.md` sections 1 and 4).
    /** Read out for an aisle section's heading: the aisle and its count. */
    aisleSection: { one: '{aisle}, {count} item', other: '{aisle}, {count} items' },
    checked: 'Checked',
    /** On the Checked row: every checked item back onto the list. */
    putBackAll: 'Put back',
    putBackAllLabel: {
      one: 'Put {count} checked item back on the list',
      other: 'Put all {count} checked items back on the list',
    },
    putBackDone: {
      one: '{count} item is back on the list.',
      other: '{count} items are back on the list.',
    },
    clearChecked: 'Clear checked',
    cleared: {
      one: '{count} checked item cleared. It stays in Recent.',
      other: '{count} checked items cleared. They stay in Recent.',
    },
    undo: 'Undo',
    recent: {
      title: 'Recent',
      count: { one: '{count} item', other: '{count} items' },
      weeks: { one: 'last week', other: 'last {count} weeks' },
      hint: 'Tap plus to put it back on the list',
      today: 'Today',
      /** A Recent row's meta: the amount it had last time. */
      last: 'Last {amount}',
      onList: 'On the list',
      putBack: 'Put {name} back on the list',
      footnote: 'Recent keeps the last 100 checked items of this household.',
      empty: 'Nothing checked yet. What you check off on the grocery list shows up here.',
    },
    /**
     * A recipe's ingredients (and later the week menu's) onto the list:
     * the add-to-groceries sheet (APP-312, designs/groceries section 5).
     */
    addLines: {
      title: 'Add to groceries',
      /** The grocery list's menu entry. */
      fromRecipe: 'From recipe or week menu',
      recipe: 'Recipe',
      recipeServes: {
        one: 'Recipe · serves {count}',
        other: 'Recipe · serves {count}',
      },
      servings: 'Servings',
      fewer: 'Fewer servings',
      more: 'More servings',
      toList: 'To list',
      noList: 'No grocery list yet',
      ingredients: 'Ingredients',
      merge: 'Already on the list: {from}, becomes {to}',
      alreadyOn: 'Already on the list',
      covered: 'Already on the list: {amount}',
      inStock: 'In stock at home',
      inStockAdding: 'In stock, adding anyway',
      inStockShort: 'in stock',
      inStockShortAdding: 'in stock, adding anyway',
      readWithAi: 'Read with AI · {used} of your {limit} today',
      readWithAiEarlier: 'Read with AI earlier',
      reading: 'Reading with AI…',
      asText: 'Added as text',
      add: { one: 'Add {count} to the list', other: 'Add {count} to the list' },
      footnote:
        'Merged with what is already there. The list shows which recipe each item is for.',
      edit: 'Edit',
      editTitle: 'Edit item',
      failed: 'These could not be added. Try again.',
    },
    aisles: {
      produce: 'Fruit and vegetables',
      bakery: 'Bread and bakery',
      dairy: 'Dairy and eggs',
      cheese_deli: 'Cheese and deli',
      meat_fish: 'Meat and fish',
      pasta_world: 'Pasta, rice and world food',
      tins_sauces: 'Tins and sauces',
      breakfast: 'Breakfast and spreads',
      snacks: 'Biscuits, sweets and crisps',
      frozen: 'Frozen',
      drinks: 'Drinks',
      care_baby: 'Toiletries and baby',
      household: 'Household',
      other: 'Other',
    } satisfies Record<GroceryAisle, string>,
    units: {
      stuks: { one: 'piece', other: 'pieces' },
      pak: { one: 'pack', other: 'packs' },
      fles: { one: 'bottle', other: 'bottles' },
      pot: { one: 'jar', other: 'jars' },
      zak: { one: 'bag', other: 'bags' },
      tros: { one: 'bunch', other: 'bunches' },
      bos: { one: 'bunch', other: 'bunches' },
      blik: { one: 'tin', other: 'tins' },
      doos: { one: 'box', other: 'boxes' },
      bak: { one: 'tub', other: 'tubs' },
      krat: { one: 'crate', other: 'crates' },
      rol: { one: 'roll', other: 'rolls' },
      net: { one: 'net', other: 'nets' },
      krop: { one: 'head', other: 'heads' },
      stronk: { one: 'head', other: 'heads' },
      tube: { one: 'tube', other: 'tubes' },
      reep: { one: 'bar', other: 'bars' },
      plak: { one: 'slice', other: 'slices' },
      bol: { one: 'bulb', other: 'bulbs' },
      teentje: { one: 'clove', other: 'cloves' },
      el: { one: 'tbsp', other: 'tbsp' },
      tl: { one: 'tsp', other: 'tsp' },
      snuf: { one: 'pinch', other: 'pinches' },
      g: { one: 'g', other: 'g' },
      kg: { one: 'kg', other: 'kg' },
      ml: { one: 'ml', other: 'ml' },
      cl: { one: 'cl', other: 'cl' },
      dl: { one: 'dl', other: 'dl' },
      l: { one: 'l', other: 'l' },
    } satisfies Record<GroceryUnit, { one: string; other: string }>,
  },

  /**
   * The one Member responsible for a task (APP-302): the Who row, the coin a
   * row shows, and the in-app notice for a task someone else gave you.
   */
  assignee: {
    who: 'Who',
    nobody: 'Nobody',
    /** The coin's label for VoiceOver. */
    assignedTo: 'Assigned to {name}',
    /** A Member who has since left, or an account that is gone. */
    someone: 'Someone',
    /** Why the Who row is off on a list (`assigneeUnavailable`). */
    unavailable: {
      readOnly:
        'Assign this task in {provider}. Gather cannot change linked lists yet.',
      notShared:
        'Only a shared {provider} project has people to give a task to.',
      unsupported: '{provider} lists have no field for who does a task.',
    },
    /** Tasks someone else gave you that you have not opened yet. */
    notice: {
      title: 'New for you',
      gaveYou: '{name} gave you a task',
    },
    refusals: {
      'assignee-not-member': 'That person is not in this group any more.',
    },
  },

  /**
   * The smart lists on the Tasks index (APP-301): views across every list,
   * by the rules in `@gather/core/smart-lists`. Keyed by `SmartListId`.
   */
  smart: {
    section: 'Smart lists',
    /** The index's ⋯ menu, which shows or hides each one on this phone. */
    menu: 'Show or hide smart lists',
    lists: {
      today: { title: 'Today', subtitle: 'Due today or overdue' },
      mine: { title: 'My tasks', subtitle: 'Assigned to you' },
      upcoming: { title: 'Upcoming', subtitle: 'Next 7 days' },
      unassigned: {
        title: 'Unassigned',
        subtitle: 'Nobody has picked these up',
      },
    },
    /** A smart list's summary: how many, from where. */
    count: { one: '{count} task', other: '{count} tasks' },
    /** What an empty smart list says. Today's is `todayEmpty`. */
    empty: {
      today: 'Nothing due today.',
      mine: 'Nothing is assigned to you.',
      upcoming: 'Nothing due in the next 7 days.',
      unassigned: 'Every task has someone.',
    },
    /** Under a smart list's count: its rows come from every list. */
    fromAll: 'From all lists',
    /** The Today section's aside when any task is late. */
    overdueCount: '{count} overdue',
    overdue: 'Overdue',
    yesterday: 'yesterday',
    /** Upcoming's day headings; `{date}` is the weekday and date. */
    days: {
      overdue: 'Overdue',
      today: 'Today · {date}',
      tomorrow: 'Tomorrow · {date}',
    },
  },

  /** The ⋯ menu's appearance entry and its sheet. */
  appearance: {
    title: 'Colour and icon',
  },

  kinds: {
    plain: {
      title: 'Plain list',
      description: 'Empty, for anything',
      defaultName: 'New list',
      startsWith: 'Starts empty.',
    },
    chores: {
      title: 'Chores',
      description: 'Jobs around the house',
      defaultName: 'Household',
      startsWith:
        'Starts with 8 sample chores in Kitchen, Bathroom and Everywhere. Remove any of them.',
    },
    packing: {
      title: 'Packing list',
      description: 'Tick off, then reset for next time',
      defaultName: 'Trip',
      startsWith:
        'Starts with 18 sample items in Clothes, Toiletries and Kids. Remove any of them.',
    },
    groceries: {
      title: 'Groceries',
      description: 'By aisle, with recipes and amounts',
      defaultName: 'Groceries',
      startsWith: 'Opens the grocery settings next.',
    },
    wishlist: {
      title: 'Wishlist',
      description: 'With a link and price per item',
      defaultName: 'Wishlist',
      startsWith: 'Starts empty. Each item gets a link and a price.',
    },
  } satisfies Record<TaskListKind, unknown>,

  icons: {
    list: 'List',
    sparkles: 'Sparkles',
    suitcase: 'Suitcase',
    cart: 'Shopping cart',
    gift: 'Gift',
    house: 'House',
    papers: 'Papers',
  } satisfies Record<TaskListIcon, string>,

  colors: {
    home: 'Amber',
    kitchen: 'Teal',
    tasting: 'Plum',
    money: 'Blue',
  } satisfies Record<TaskListColor, string>,

  /**
   * A repeating task (APP-303): the Repeat row and sheet, the summary on a
   * row, and the completion history. Shared with the web (APP-308).
   */
  repeat: {
    title: 'Repeat',
    done: 'Done',
    /** The segmented control at the top of the sheet. */
    modes: {
      none: 'Never',
      fixed: 'Fixed schedule',
      afterDone: 'After done',
    },
    every: 'Every',
    on: 'On',
    afterDone: 'After done',
    /** The unit picker's words, after the count. */
    units: {
      day: { one: 'day', other: 'days' },
      week: { one: 'week', other: 'weeks' },
      month: { one: 'month', other: 'months' },
      year: { one: 'year', other: 'years' },
    },
    decrease: 'Fewer',
    increase: 'More',
    /** A monthly or yearly rule follows the task's date. */
    onMonthDay: 'On day {day}',
    onDate: 'On {date}',
    followsDate: 'Change the date to move it.',
    lastDayHint: 'In months without day {day}, it falls on the last day.',
    /** The row's value, and the line under a task's title. */
    summary: {
      never: 'Never',
      every: {
        day: { one: 'Every day', other: 'Every {count} days' },
        week: { one: 'Every week', other: 'Every {count} weeks' },
        month: { one: 'Every month', other: 'Every {count} months' },
        year: { one: 'Every year', other: 'Every {count} years' },
      },
      afterDone: {
        day: { one: '1 day after done', other: '{count} days after done' },
        week: { one: '1 week after done', other: '{count} weeks after done' },
        month: {
          one: '1 month after done',
          other: '{count} months after done',
        },
      },
      onDays: '{every}, {days}',
      onMonthDay: '{every} on day {day}',
      onDate: '{every} on {date}',
    },
    /** The preview card. */
    next: 'Next',
    nextAfter: 'After {date}: {dates}',
    nextIfDoneToday: 'If done today: {date}',
    nextNever: 'Does not come back',
    pickDay: 'Pick at least one day',
    footnote:
      'One occurrence is open at a time. Miss it and it stays overdue; no copies pile up.',
    footnoteNever: 'A date alone sets no reminder and no repeat.',
    /** A linked list's task: its repeat lives in the other app. */
    linked:
      'This list lives in {provider}. Gather reads it but cannot write to it, so set the repeat in {provider}.',
    /** After completing a repeating task. */
    completed: 'Done. Next: {date}',
    undo: 'Undo',
    undoFailed: 'That could not be undone.',
    /** The history on the task screen. */
    history: 'Done before',
    historyEntry: '{name}, {when}',
    someone: 'Someone',
  },

  /** What a template's starter items are called once they are on a list. */
  starters: {
    bins: 'Put the bins out',
    fridge: 'Clean out the fridge',
    dishwasher: 'Descale the dishwasher',
    bathroom: 'Clean the bathroom',
    towels: 'Wash the towels',
    plants: 'Water the plants',
    vacuum: 'Vacuum',
    windows: 'Clean the windows',
    rainJackets: 'Rain jackets',
    walkingShoes: 'Walking shoes',
    jumpers: 'Jumpers',
    swimwear: 'Swimwear',
    underwear: 'Underwear',
    socks: 'Socks',
    pyjamas: 'Pyjamas',
    toothbrushes: 'Toothbrushes',
    toothpaste: 'Toothpaste',
    sunscreen: 'Sunscreen',
    medicines: 'Medicines',
    deodorant: 'Deodorant',
    shampoo: 'Shampoo',
    nappies: 'Nappies',
    cuddlyToy: 'Cuddly toy',
    travelCot: 'Travel cot',
    travelToys: 'Toys for the journey',
    snacks: 'Snacks',
  } satisfies Record<TaskStarterKey, string>,

  /** The sections a template's starter items arrive in (APP-357). */
  starterSections: {
    kitchen: 'Kitchen',
    bathroom: 'Bathroom',
    everywhere: 'Everywhere',
    clothes: 'Clothes',
    toiletries: 'Toiletries',
    kids: 'Kids',
  } satisfies Record<TaskStarterSectionKey, string>,
}
