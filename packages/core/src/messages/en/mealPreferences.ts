/**
 * Meal preferences ("Eetvoorkeuren", APP-318) and the words the planner's
 * recipe search uses to say why a recipe does not fit. Copy from
 * designs/meal-planner/README.md section 2; the phone and, later, the web
 * read the same tree.
 */
export const mealPreferences = {
  title: 'Meal preferences',
  subhead:
    'For all of {group}. Gather uses this when you choose yourself, in Plan my week and in Something else.',
  closing:
    'Everyone in {group} can change this; changes apply at once. Meal preferences are included when you export your data.',
  saveFailed: 'Could not save. Try again.',
  openPreferences: 'Meal preferences',

  /** Monday first, as everywhere in the meal planner. */
  dayShort: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  dayLong: [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ],

  who: {
    heading: 'Who eats',
    eatsByDefault: 'Eats along by default',
    notByDefault: 'Does not eat along by default',
    servings: 'Servings per meal',
    servingsSame: 'By default the same as who eats ({count})',
    servingsAdjusted: 'Adjusted; eating by default: {count}',
    servingsReset: 'Same as who eats',
    footnote:
      'Someone not eating one time? Tap that meal in the week menu. An appointment in the calendar already sets it up for you.',
  },
  plan: {
    heading: 'What to plan',
    slots: { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' },
    footnote:
      'Only what is on gets a place in the week menu and in Plan my week.',
  },
  time: {
    heading: 'Cooking time per day',
    none: 'none',
    minutes: '{minutes}',
    cellLabel: '{day}: at most {minutes} minutes',
    cellLabelNone: '{day}: no maximum',
    hint: 'Changes the time',
    footnote:
      'On a busy evening in the calendar, Gather picks something quick, whatever it says here.',
  },
  diet: {
    heading: 'Diet',
    names: {
      vegetarian: 'Vegetarian',
      vegan: 'Vegan',
      pescatarian: 'Pescatarian',
      'gluten-free': 'Gluten-free',
      'lactose-free': 'Lactose-free',
      halal: 'Halal',
    },
    footnote: 'Applies to the whole group. Nothing chosen: anything goes.',
  },
  allergies: {
    heading: 'Allergies',
    names: {
      gluten: 'Gluten',
      crustaceans: 'Crustaceans',
      eggs: 'Eggs',
      fish: 'Fish',
      peanuts: 'Peanuts',
      soy: 'Soy',
      milk: 'Milk',
      nuts: 'Nuts',
      celery: 'Celery',
      mustard: 'Mustard',
      sesame: 'Sesame',
      sulphites: 'Sulphites',
      lupin: 'Lupin',
      molluscs: 'Molluscs',
    },
    footnote:
      'Gather skips a recipe when the ingredient is recognisably in it. When in doubt it says "check yourself". With an allergy, always check the label yourself.',
  },
  dislikes: {
    heading: 'Rather not',
    placeholder: 'Add, for example coriander',
    remove: 'Remove {name}',
    empty: 'Nothing yet.',
    tooMany: 'That is the most this list holds.',
  },
  variety: {
    heading: 'Variety',
    noRepeat: 'Same recipe not within',
    noRepeatValue: { one: '{count} day', other: '{count} days' },
    meatFree: 'Meat-free nights',
    meatFreeValue: { one: '{count} a week', other: '{count} a week' },
    fishNight: 'Fish night',
    decrease: 'Fewer',
    increase: 'More',
  },
  leftovers: {
    heading: 'Leftovers',
    cookDouble: 'Cook double',
    footnote:
      'On these days Gather cooks more servings. The next day becomes "Leftovers", unless something is already planned there.',
  },
  extra: {
    heading: 'Extra',
    budget: 'Weekly budget',
    budgetLabel: 'Weekly budget in euros',
    budgetNone: 'None',
    budgetPlaceholder: 'None',
    budgetInvalid: 'Enter an amount, for example 85 or 85.50.',
    cuisines: 'Favourite cuisines',
    cuisineNames: {
      italian: 'Italian',
      mexican: 'Mexican',
      asian: 'Asian',
      dutch: 'Dutch',
      'middle-eastern': 'Middle Eastern',
      indian: 'Indian',
    },
    footnote:
      'The budget only counts when recipes have a price. Without a budget, Gather does not look at it.',
  },
  smart: {
    heading: 'Smart suggestions',
    useStock: 'Use what is in stock',
    useCalendar: 'Take the calendar into account',
    preferHighRated: 'Prefer highly rated',
    footnote:
      'Plan my week, Something else and New idea each cost 1 smart action from your own daily limit of 30. Choosing yourself with these filters is always free.',
  },

  /** The planner's recipe search (design section 1, "Pick"). */
  filter: {
    chip: 'Matches preferences',
    hidden: {
      one: '{count} recipe hidden by your preferences ({reasons}). Tap Matches preferences to see it.',
      other:
        '{count} recipes hidden by your preferences ({reasons}). Tap Matches preferences to see them.',
    },
    contains: 'Contains {term}',
    containsDislike: 'Contains {term}, on your rather-not list',
    notDiet: 'Not {diet}: {term}',
    tooLong: 'Takes {minutes} min, at most {limit} that day',
    checkYourself: 'check yourself',
    checkYourselfFor: 'Check yourself: {what}',
  },
}
