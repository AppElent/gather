import type { BabyEventType } from '../babyEvents'
import type { MealName } from '../consumption'
import type { NutritionFacts } from '../nutrition'

/**
 * The Sample household: fake content for dev and preview environments only,
 * never production (ADR 0004).
 *
 * Everything date-bearing is expressed as an offset from the moment the seed
 * runs, never as a literal date. The Sample household is wiped and recreated
 * on every run precisely so those offsets stay fresh — a fixed date would
 * leave the baby log and the food diary looking abandoned a week later.
 *
 * Content is handwritten rather than generated: the whole point of a
 * populated preview is seeing what the app looks like with real-shaped
 * content in it, and faker output ("Handcrafted Rubber Chicken") defeats
 * that. Faker is reserved for padding lists out to test volume.
 */

/** Who authored a piece of Group-scoped content. */
export type SampleAuthor = 'owner' | 'nora' | 'sam'

export const SAMPLE_GROUP_NAME = 'Willow Street'

/**
 * Housemates. These get `users` rows with synthetic Clerk subjects that
 * nobody can ever sign in as — they exist only so Attribution, the member
 * list and "logged by" have more than one name in them.
 *
 * The `sample:` prefix keeps them impossible to confuse with a real Clerk
 * subject (`user_2…`), and the reset deletes them by id, not by prefix.
 */
export const SAMPLE_HOUSEMATES: {
  key: Exclude<SampleAuthor, 'owner'>
  clerkId: string
  name: string
  email: string
}[] = [
  {
    key: 'nora',
    clerkId: 'sample:nora',
    name: 'Nora Vermeer',
    email: 'nora@example.invalid',
  },
  {
    key: 'sam',
    clerkId: 'sample:sam',
    name: 'Sam Okonkwo',
    email: 'sam@example.invalid',
  },
]

export interface SampleRecipe {
  key: string
  author: SampleAuthor
  title: string
  description: string
  ingredients: string[]
  steps: string[]
  tags: string[]
  rating?: number
  prepMinutes?: number
  servings: number
  /** Per serving, matching how `recipes.nutrition` is stored. */
  nutrition: NutritionFacts
}

export const SAMPLE_RECIPES: SampleRecipe[] = [
  {
    key: 'shakshuka',
    author: 'owner',
    title: 'Shakshuka',
    description:
      'Eggs poached in a spiced tomato and pepper sauce. Weeknight dinner that pretends to be brunch.',
    ingredients: [
      '2 tbsp olive oil',
      '1 onion, sliced',
      '1 red bell pepper, sliced',
      '3 cloves garlic, sliced',
      '1 tsp ground cumin',
      '1 tsp sweet paprika',
      '1 tin chopped tomatoes (400 g)',
      '4 eggs',
      '60 g feta',
      'Flat-leaf parsley, to serve',
    ],
    steps: [
      'Warm the oil in a wide frying pan and cook the onion and pepper over medium heat until soft, about 10 minutes.',
      'Add the garlic, cumin and paprika and cook for another minute, until fragrant.',
      'Pour in the tomatoes, season, and simmer for 10–15 minutes until thickened.',
      'Make four wells in the sauce and crack an egg into each. Cover and cook for 5–7 minutes, until the whites are set but the yolks still run.',
      'Crumble over the feta, scatter with parsley, and serve straight from the pan with bread.',
    ],
    tags: ['vegetarian', 'one-pan', 'brunch'],
    rating: 5,
    prepMinutes: 35,
    servings: 4,
    nutrition: {
      calories: 268,
      protein: 14.2,
      carbs: 12.6,
      sugars: 8.1,
      fat: 17.8,
      saturatedFat: 5.9,
      fiber: 3.2,
      salt: 1.1,
    },
  },
  {
    key: 'lasagne',
    author: 'nora',
    title: 'Lasagne alla bolognese',
    description:
      'The long one. Worth starting on a Sunday afternoon — the ragù needs three hours and no shortcuts.',
    ingredients: [
      '500 g beef mince',
      '1 onion, finely diced',
      '2 carrots, finely diced',
      '2 sticks celery, finely diced',
      '250 ml whole milk',
      '2 tins chopped tomatoes (800 g)',
      '300 g lasagne sheets',
      '50 g butter',
      '50 g plain flour',
      '600 ml whole milk, for the béchamel',
      '80 g parmesan, grated',
    ],
    steps: [
      'Sweat the onion, carrot and celery in oil over low heat for 15 minutes until completely soft.',
      'Turn the heat up, add the mince and brown it properly — let it catch a little.',
      'Pour in the 250 ml of milk and simmer until almost gone, then add the tomatoes.',
      'Cover partially and cook on the lowest heat for 3 hours, stirring now and then.',
      'For the béchamel, melt the butter, stir in the flour, cook for 2 minutes, then whisk in the milk gradually until thick.',
      'Layer ragù, pasta and béchamel three times, finishing with béchamel and parmesan.',
      'Bake at 180°C for 40 minutes until browned and bubbling. Rest 15 minutes before cutting.',
    ],
    tags: ['pasta', 'weekend', 'batch-cook'],
    rating: 5,
    prepMinutes: 240,
    servings: 8,
    nutrition: {
      calories: 512,
      protein: 29.4,
      carbs: 46.2,
      sugars: 11.3,
      fat: 22.1,
      saturatedFat: 11.4,
      fiber: 4.1,
      salt: 1.4,
    },
  },
  {
    key: 'tarka-dal',
    author: 'sam',
    title: 'Tarka dal',
    description:
      'Cheap, fast, and better the next day. The tempered spices poured over at the end are the whole dish.',
    ingredients: [
      '250 g red lentils, rinsed',
      '1 tsp ground turmeric',
      '3 tbsp ghee or butter',
      '1 tsp cumin seeds',
      '3 cloves garlic, sliced',
      '2 dried red chillies',
      '1 tomato, chopped',
      'Coriander, to serve',
    ],
    steps: [
      'Simmer the lentils with the turmeric and 750 ml water for 25 minutes, skimming the foam, until collapsed and soupy.',
      'Season well with salt — dal needs more than you think.',
      'Heat the ghee in a small pan. Add the cumin seeds and wait for them to pop.',
      'Add the garlic and chillies and fry until the garlic is deep gold, then add the tomato and cook for a minute.',
      'Pour the whole lot over the dal, stir once, and serve with rice.',
    ],
    tags: ['vegetarian', 'quick', 'freezer-friendly'],
    rating: 4,
    prepMinutes: 40,
    servings: 4,
    nutrition: {
      calories: 341,
      protein: 16.8,
      carbs: 42.3,
      sugars: 2.9,
      fat: 11.6,
      saturatedFat: 6.2,
      fiber: 8.4,
      salt: 0.9,
    },
  },
  {
    key: 'chicken-traybake',
    author: 'owner',
    title: 'Chicken and potato traybake',
    description:
      'One tin, one oven, no thinking. The potatoes cook in the chicken fat, which is the entire trick.',
    ingredients: [
      '4 chicken thighs, bone in',
      '800 g potatoes, cut into chunks',
      '2 red bell peppers, cut into strips',
      '1 onion, cut into wedges',
      '3 tbsp olive oil',
      '2 tsp dried oregano',
      '1 lemon, halved',
    ],
    steps: [
      'Heat the oven to 200°C.',
      'Toss the potatoes, peppers and onion with the oil and oregano in a large roasting tin, and season.',
      'Nestle the chicken thighs on top, skin up, and season the skin.',
      'Roast for 45–50 minutes until the potatoes are golden and the chicken skin is crisp.',
      'Squeeze the lemon over everything before serving.',
    ],
    tags: ['one-pan', 'weeknight'],
    rating: 4,
    prepMinutes: 60,
    servings: 4,
    nutrition: {
      calories: 486,
      protein: 28.1,
      carbs: 38.4,
      sugars: 6.2,
      fat: 24.3,
      saturatedFat: 5.4,
      fiber: 5.1,
      salt: 0.6,
    },
  },
  {
    key: 'pasta-puttanesca',
    author: 'nora',
    title: 'Pasta puttanesca',
    description:
      'Entirely from the cupboard. Ready in the time the pasta takes to cook.',
    ingredients: [
      '400 g spaghetti',
      '3 tbsp olive oil',
      '4 anchovy fillets',
      '3 cloves garlic, sliced',
      '1/2 tsp chilli flakes',
      '1 tin chopped tomatoes (400 g)',
      '100 g black olives, pitted',
      '2 tbsp capers, rinsed',
    ],
    steps: [
      'Put the pasta on to boil in well-salted water.',
      'Warm the oil with the anchovies over low heat until they dissolve completely.',
      'Add the garlic and chilli and cook for 30 seconds, then the tomatoes, olives and capers.',
      'Simmer for as long as the pasta has left, around 8 minutes.',
      'Drain the pasta, keeping a mugful of the water, and toss it through the sauce, loosening with the water as needed.',
    ],
    tags: ['pasta', 'quick', 'store-cupboard'],
    rating: 4,
    prepMinutes: 20,
    servings: 4,
    nutrition: {
      calories: 468,
      protein: 14.6,
      carbs: 74.8,
      sugars: 5.4,
      fat: 12.7,
      saturatedFat: 1.9,
      fiber: 5.3,
      salt: 1.8,
    },
  },
  {
    key: 'chickpea-curry',
    author: 'sam',
    title: 'Chickpea and spinach curry',
    description: 'Two tins and a bag of spinach. The default Tuesday.',
    ingredients: [
      '2 tbsp olive oil',
      '1 onion, diced',
      '3 cloves garlic, crushed',
      '1 thumb ginger, grated',
      '2 tbsp curry powder',
      '1 tin chopped tomatoes (400 g)',
      '2 tins chickpeas (480 g drained)',
      '200 ml coconut milk',
      '200 g spinach',
    ],
    steps: [
      'Fry the onion in the oil until soft and starting to colour, about 8 minutes.',
      'Add the garlic, ginger and curry powder and cook for a minute.',
      'Add the tomatoes, chickpeas and coconut milk, and simmer for 15 minutes.',
      'Stir the spinach through in handfuls until wilted, then season and serve with rice.',
    ],
    tags: ['vegan', 'quick', 'weeknight'],
    rating: 4,
    prepMinutes: 30,
    servings: 4,
    nutrition: {
      calories: 394,
      protein: 14.1,
      carbs: 38.7,
      sugars: 9.8,
      fat: 19.4,
      saturatedFat: 8.7,
      fiber: 11.2,
      salt: 1.2,
    },
  },
  {
    key: 'greek-salad',
    author: 'owner',
    title: 'Greek salad',
    description:
      'No lettuce. Cut everything big, dress it heavily, and let it sit for ten minutes first.',
    ingredients: [
      '4 tomatoes, cut into wedges',
      '1 cucumber, halved and sliced thick',
      '1/2 red onion, sliced thin',
      '150 g feta, in one slab',
      '100 g black olives',
      '4 tbsp olive oil',
      '1 tsp dried oregano',
    ],
    steps: [
      'Put the tomatoes, cucumber and onion in a wide bowl and salt them.',
      'Leave for 10 minutes so the tomatoes give up some juice.',
      'Add the olives, pour over the oil, and turn everything gently.',
      'Lay the feta on top in one piece and dust it with the oregano.',
    ],
    tags: ['vegetarian', 'no-cook', 'summer'],
    rating: 5,
    prepMinutes: 15,
    servings: 4,
    nutrition: {
      calories: 258,
      protein: 7.4,
      carbs: 8.1,
      sugars: 6.3,
      fat: 22.1,
      saturatedFat: 8.2,
      fiber: 2.4,
      salt: 2.1,
    },
  },
  {
    key: 'banana-oat-pancakes',
    author: 'nora',
    title: 'Banana oat pancakes',
    description:
      'Three ingredients, blended. What happens to bananas nobody ate in time.',
    ingredients: [
      '2 ripe bananas',
      '100 g rolled oats',
      '2 eggs',
      '1 tsp baking powder',
      'Butter, for frying',
    ],
    steps: [
      'Blend everything except the butter until smooth, then let the batter stand for 5 minutes to thicken.',
      'Melt a little butter in a non-stick pan over medium-low heat.',
      'Cook the pancakes in spoonfuls for 2–3 minutes a side, until bubbles set on top and the underside is golden.',
      'Serve with yoghurt and whatever fruit is around.',
    ],
    tags: ['breakfast', 'quick', 'kids'],
    rating: 4,
    prepMinutes: 20,
    servings: 2,
    nutrition: {
      calories: 372,
      protein: 13.8,
      carbs: 54.6,
      sugars: 15.2,
      fat: 11.4,
      saturatedFat: 4.1,
      fiber: 7.2,
      salt: 0.6,
    },
  },
  {
    key: 'minestrone',
    author: 'sam',
    title: 'Minestrone',
    description:
      'Whatever vegetables are going over. The parmesan rind in the pot is not optional.',
    ingredients: [
      '2 tbsp olive oil',
      '1 onion, diced',
      '2 carrots, diced',
      '2 sticks celery, diced',
      '2 cloves garlic, crushed',
      '1 tin chopped tomatoes (400 g)',
      '1 tin cannellini beans, drained',
      '1 parmesan rind',
      '1.2 l vegetable stock',
      '100 g small pasta',
      '100 g spinach',
    ],
    steps: [
      'Sweat the onion, carrot and celery in the oil for 12 minutes until soft.',
      'Add the garlic, then the tomatoes, beans, parmesan rind and stock.',
      'Simmer gently for 30 minutes.',
      'Add the pasta and cook until just done, then stir the spinach through.',
      'Fish out the rind, check the seasoning, and serve with more parmesan.',
    ],
    tags: ['soup', 'batch-cook', 'vegetarian'],
    rating: 4,
    prepMinutes: 55,
    servings: 6,
    nutrition: {
      calories: 246,
      protein: 10.2,
      carbs: 34.8,
      sugars: 7.6,
      fat: 7.1,
      saturatedFat: 1.8,
      fiber: 7.4,
      salt: 1.3,
    },
  },
  {
    key: 'salmon-rice-bowl',
    author: 'owner',
    title: 'Salmon and rice bowl',
    description:
      'Fifteen minutes if the rice is already cooked. Good use of leftover rice.',
    ingredients: [
      '2 salmon fillets',
      '300 g cooked white rice',
      '2 tbsp soy sauce',
      '1 tbsp honey',
      '1 tsp sesame oil',
      '1 cucumber, sliced',
      '2 spring onions, sliced',
      'Sesame seeds',
    ],
    steps: [
      'Mix the soy, honey and sesame oil.',
      'Sear the salmon skin-side down in a hot pan for 4 minutes, turn, and cook 2 more.',
      'Spoon the glaze over and let it bubble and thicken around the fish.',
      'Serve on the rice with the cucumber and spring onion, and a scatter of sesame seeds.',
    ],
    tags: ['fish', 'quick', 'weeknight'],
    rating: 5,
    prepMinutes: 20,
    servings: 2,
    nutrition: {
      calories: 592,
      protein: 34.2,
      carbs: 62.4,
      sugars: 10.6,
      fat: 20.8,
      saturatedFat: 4.2,
      fiber: 2.1,
      salt: 2.4,
    },
  },
  {
    key: 'spinach-feta-pie',
    author: 'nora',
    title: 'Spinach and feta filo pie',
    description:
      'Squeeze the spinach much drier than feels reasonable, or the base goes soggy.',
    ingredients: [
      '500 g spinach',
      '200 g feta, crumbled',
      '2 eggs',
      '1 onion, finely diced',
      'Grated nutmeg',
      '6 sheets filo pastry',
      '60 g butter, melted',
    ],
    steps: [
      'Wilt the spinach, cool it, then squeeze out as much water as you possibly can.',
      'Soften the onion in a little butter and let it cool.',
      'Mix the spinach, onion, feta, eggs and nutmeg, and season carefully — the feta is already salty.',
      'Layer 4 filo sheets in a tin, brushing each with butter. Add the filling.',
      'Top with the remaining sheets, scrunched, brush with butter, and bake at 190°C for 35 minutes.',
    ],
    tags: ['vegetarian', 'baking'],
    rating: 5,
    prepMinutes: 70,
    servings: 6,
    nutrition: {
      calories: 318,
      protein: 13.6,
      carbs: 21.4,
      sugars: 2.8,
      fat: 19.8,
      saturatedFat: 11.2,
      fiber: 3.1,
      salt: 1.6,
    },
  },
  {
    key: 'overnight-oats',
    author: 'sam',
    title: 'Overnight oats',
    description: 'Assembled the night before by someone who will not be awake.',
    ingredients: [
      '40 g rolled oats',
      '120 ml semi-skimmed milk',
      '80 g Greek yoghurt',
      '1 tsp peanut butter',
      '1 banana, sliced',
    ],
    steps: [
      'Stir the oats, milk and yoghurt together in a jar.',
      'Refrigerate overnight.',
      'Top with the peanut butter and banana in the morning.',
    ],
    tags: ['breakfast', 'no-cook', 'make-ahead'],
    rating: 3,
    prepMinutes: 5,
    servings: 1,
    nutrition: {
      calories: 428,
      protein: 18.4,
      carbs: 58.2,
      sugars: 24.6,
      fat: 12.8,
      saturatedFat: 4.3,
      fiber: 7.1,
      salt: 0.3,
    },
  },
]

export interface SampleTask {
  title: string
  done: boolean
  /** Days from the seed run; negative is overdue. Absent means no due date. */
  dueInDays?: number
  priority?: 1 | 2 | 3 | 4
  labels?: string[]
  author: SampleAuthor
}

export interface SampleTaskList {
  name: string
  tasks: SampleTask[]
}

export const SAMPLE_TASK_LISTS: SampleTaskList[] = [
  {
    name: 'Groceries',
    tasks: [
      { title: 'Olive oil', done: false, author: 'owner' },
      { title: 'Feta (two blocks)', done: false, author: 'nora' },
      { title: 'Rolled oats', done: false, priority: 4, author: 'owner' },
      { title: 'Nappies, size 3', done: false, priority: 1, author: 'sam' },
      { title: 'Tinned tomatoes ×6', done: true, author: 'nora' },
      { title: 'Coffee beans', done: true, author: 'owner' },
    ],
  },
  {
    name: 'House',
    tasks: [
      {
        title: 'Bleed the radiators',
        done: false,
        dueInDays: -3,
        priority: 2,
        labels: ['maintenance'],
        author: 'sam',
      },
      {
        title: 'Book the boiler service',
        done: false,
        dueInDays: 5,
        priority: 1,
        labels: ['maintenance', 'admin'],
        author: 'owner',
      },
      {
        title: 'Replace the smoke alarm battery',
        done: false,
        dueInDays: 12,
        priority: 3,
        author: 'nora',
      },
      {
        title: 'Descale the kettle',
        done: true,
        labels: ['kitchen'],
        author: 'sam',
      },
    ],
  },
  {
    name: 'Weekend',
    tasks: [
      {
        title: 'Start the ragù by 2pm',
        done: false,
        dueInDays: 2,
        priority: 2,
        author: 'nora',
      },
      {
        title: 'Take the recycling out',
        done: false,
        dueInDays: 1,
        author: 'owner',
      },
      {
        title: 'Return the library books',
        done: false,
        dueInDays: 3,
        author: 'sam',
      },
      { title: 'Fix the shed door', done: false, author: 'sam' },
    ],
  },
]

/** Kitchen fixtures exercise every connected household module on the phone. */
export const SAMPLE_KITCHEN = {
  groceryList: 'Groceries',
  meals: [
    { title: 'Penne carbonara', prepMinutes: 20, author: 'nora' as const },
    { title: 'Tomato soup', prepMinutes: 10, author: 'sam' as const },
  ],
  dinners: [
    { recipe: 'shakshuka', daysAhead: 0 },
    { meal: 'Penne carbonara', daysAhead: 1, quickLimit: 20 as const },
  ],
  pantry: [
    { title: 'Basmati rice', quantity: '1 kg', author: 'owner' as const },
    { title: 'Tinned tomatoes', quantity: '4 tins', author: 'nora' as const },
  ],
  calendars: [
    {
      name: 'Family',
      author: 'owner' as const,
      events: [
        {
          title: 'Dentist',
          daysAhead: 0,
          startMinutes: 9 * 60,
          endMinutes: 9 * 60 + 30,
          author: 'owner' as const,
        },
        { title: 'Pick up groceries', daysAhead: 1, author: 'sam' as const },
      ],
    },
  ],
}

export interface SampleNote {
  title: string
  body: string
  pinned: boolean
  author: SampleAuthor
  daysAgo: number
}

export const SAMPLE_NOTES: SampleNote[] = [
  {
    title: 'Wifi and door codes',
    body: 'Wifi: WillowStreet-5G\nPassword: on the fridge, under the magnet\n\nFront door: 4821',
    pinned: true,
    author: 'owner',
    daysAgo: 1,
  },
  {
    title: 'Boiler service',
    body: 'Pressure should sit between 1 and 1.5 bar when cold. Next service is due in April.',
    pinned: true,
    author: 'nora',
    daysAgo: 4,
  },
  {
    title: 'Holiday packing',
    body: 'Passports, EHIC cards, adapters, and Emma’s bear.',
    pinned: false,
    author: 'sam',
    daysAgo: 11,
  },
]

export const SAMPLE_BABY = {
  name: 'Juno',
  /** Roughly five months old at seed time. */
  ageInDays: 152,
  sex: 'female' as const,
  /**
   * What Juno's log offers (ADR-0022). Set explicitly rather than left absent,
   * so a preview shows a Child that has been through setup — a seeded Child
   * with no stored offer would look like one nobody had configured, which is
   * the opposite of what a preview is for.
   *
   * Six of the nine: what a five-month-old's household actually reaches for.
   * `growth` is in because the weigh-in below needs somewhere to be logged,
   * and `memory` because a preview of a baby log with no firsts in it shows
   * the machinery and not the reason anybody keeps one.
   */
  trackedTypes: [
    'feeding',
    'diaper',
    'sleep',
    'temperature',
    'growth',
    'note',
    'memory',
  ] as BabyEventType[],

  /**
   * The two lists every Child gets, with something already in them. An empty
   * checklist in a preview shows the control but not the point of it.
   */
  todos: [
    'Book the six-month check-up',
    'Order size 3 diapers',
    'Move the cot to the lower setting',
  ],
  questions: [
    'Is waking twice a night still normal at five months?',
    'When should we start a second solid meal?',
  ],
}

export interface SampleBabyEvent {
  type: BabyEventType
  /** Days before the seed run. */
  daysAgo: number
  /** Local hour and minute on that day. */
  hour: number
  minute: number
  /** Minutes the session lasted; sets `endTimestamp`. */
  durationMinutes?: number
  notes?: string
  loggedBy: SampleAuthor
  data: Record<string, unknown>
}

/**
 * Four days of a fairly ordinary log — feeds, sleeps and nappies through each
 * day, with a weigh-in, a milestone and one mild temperature to give the
 * other event types something to render.
 */
export const SAMPLE_BABY_EVENTS: SampleBabyEvent[] = [
  // Today
  {
    type: 'feeding',
    daysAgo: 0,
    hour: 7,
    minute: 10,
    durationMinutes: 22,
    loggedBy: 'owner',
    data: { method: 'breast', side: 'both', leftMin: 12, rightMin: 10 },
  },
  {
    type: 'diaper',
    daysAgo: 0,
    hour: 7,
    minute: 45,
    loggedBy: 'owner',
    data: { kind: 'both' },
  },
  {
    type: 'sleep',
    daysAgo: 0,
    hour: 9,
    minute: 15,
    durationMinutes: 75,
    notes: 'Went down without a fuss for once.',
    loggedBy: 'nora',
    data: {},
  },
  {
    type: 'feeding',
    daysAgo: 0,
    hour: 11,
    minute: 0,
    loggedBy: 'nora',
    data: { method: 'bottle', amountMl: 150 },
  },
  {
    type: 'note',
    daysAgo: 0,
    hour: 11,
    minute: 30,
    notes: 'Rolled front to back, twice, both deliberate.',
    loggedBy: 'sam',
    data: { milestone: true },
  },
  {
    // No photo: seeding one would mean putting bytes in the deployment's
    // storage on every reset, and a memory is its sentence — the picture is
    // the thing you add on the phone, where the camera is.
    type: 'memory',
    daysAgo: 0,
    hour: 8,
    minute: 15,
    notes: 'Sam pulled a face and she went for it.',
    loggedBy: 'nora',
    data: { what: 'First proper laugh' },
  },
  // Yesterday
  {
    type: 'feeding',
    daysAgo: 1,
    hour: 6,
    minute: 50,
    durationMinutes: 18,
    loggedBy: 'owner',
    data: { method: 'breast', side: 'left', leftMin: 18 },
  },
  {
    type: 'diaper',
    daysAgo: 1,
    hour: 8,
    minute: 20,
    loggedBy: 'sam',
    data: { kind: 'wet' },
  },
  {
    type: 'sleep',
    daysAgo: 1,
    hour: 13,
    minute: 0,
    durationMinutes: 95,
    loggedBy: 'nora',
    data: {},
  },
  {
    type: 'feeding',
    daysAgo: 1,
    hour: 17,
    minute: 30,
    loggedBy: 'owner',
    data: { method: 'solid', amountG: 60 },
  },
  {
    type: 'diaper',
    daysAgo: 1,
    hour: 19,
    minute: 5,
    loggedBy: 'nora',
    data: { kind: 'dirty' },
  },
  // Two days ago
  {
    type: 'temperature',
    daysAgo: 2,
    hour: 21,
    minute: 40,
    notes: 'Warm and grizzly after the jabs. Settled by midnight.',
    loggedBy: 'owner',
    data: { celsius: 37.8, method: 'ear' },
  },
  {
    type: 'vaccination',
    daysAgo: 2,
    hour: 14,
    minute: 15,
    loggedBy: 'sam',
    data: { name: '16-week immunisations' },
  },
  {
    type: 'feeding',
    daysAgo: 2,
    hour: 7,
    minute: 20,
    durationMinutes: 20,
    loggedBy: 'owner',
    data: { method: 'breast', side: 'both', leftMin: 11, rightMin: 9 },
  },
  {
    type: 'sleep',
    daysAgo: 2,
    hour: 10,
    minute: 0,
    durationMinutes: 50,
    loggedBy: 'nora',
    data: {},
  },
  // Three days ago
  {
    type: 'growth',
    daysAgo: 3,
    hour: 11,
    minute: 0,
    notes: 'Health visitor weigh-in. Tracking the 50th.',
    loggedBy: 'nora',
    data: { weightKg: 6.8, heightCm: 63.5, headCircumferenceCm: 41.2 },
  },
  {
    type: 'medication',
    daysAgo: 3,
    hour: 20,
    minute: 30,
    loggedBy: 'owner',
    data: { name: 'Vitamin D drops', doseAmount: 400, doseUnit: 'IU' },
  },
  {
    type: 'feeding',
    daysAgo: 3,
    hour: 12,
    minute: 45,
    loggedBy: 'sam',
    data: { method: 'bottle', amountMl: 140 },
  },
  {
    type: 'diaper',
    daysAgo: 3,
    hour: 15,
    minute: 10,
    loggedBy: 'sam',
    data: { kind: 'wet' },
  },
]

/**
 * A food diary entry. It names what it references rather than carrying
 * nutrition figures: the seed resolves the Catalog food or Sample recipe and
 * computes the snapshot with the same helpers the app uses, so a seeded
 * entry is arithmetically identical to one a person logged.
 */
export type SampleDiaryEntry = {
  daysAgo: number
  meal: MealName
  label: string
} & (
  | {
      kind: 'food'
      seedKey: string
      quantity: number
      unit: 'g' | 'ml' | 'piece'
    }
  | { kind: 'recipe'; recipeKey: string; servings: number }
)

/** Seven days of the owner's diary, thinning out toward the older end. */
/**
 * A Combo the sample person has saved, so a preview shows the fastest path in
 * the add sheet rather than an empty section (ADR-0012).
 *
 * Components name what they point at the same way the diary fixtures do — a
 * Catalog `seedKey` or a recipe key — because a Combo holds references, and
 * the seed has to resolve them to real rows just as saving a meal does.
 */
export interface SampleComboItem {
  label: string
  quantity: number
  unit: 'serving' | 'g' | 'ml' | 'piece'
  seedKey?: string
  recipeKey?: string
  /** Only for a one-off, which has nothing behind it to read figures from. */
  nutrition?: NutritionFacts
}

export interface SampleCombo {
  name: string
  items: SampleComboItem[]
}

export const SAMPLE_COMBOS: SampleCombo[] = [
  {
    name: 'Usual breakfast',
    items: [
      {
        label: 'Porridge oats',
        quantity: 60,
        unit: 'g',
        seedKey: 'oats-rolled',
      },
      {
        label: 'Semi-skimmed milk',
        quantity: 200,
        unit: 'ml',
        seedKey: 'milk-semi-skimmed',
      },
      { label: 'Banana', quantity: 118, unit: 'g', seedKey: 'banana' },
    ],
  },
  {
    name: 'Desk lunch',
    items: [
      {
        label: 'Greek salad',
        quantity: 1,
        unit: 'serving',
        recipeKey: 'greek-salad',
      },
      {
        label: 'Wholemeal bread',
        quantity: 80,
        unit: 'g',
        seedKey: 'bread-wholemeal',
      },
      {
        label: 'Flat white from downstairs',
        quantity: 1,
        unit: 'piece',
        nutrition: { calories: 120, protein: 6.5, fat: 6.4, carbs: 9.6 },
      },
    ],
  },
]

export const SAMPLE_DIARY: SampleDiaryEntry[] = [
  // Today
  {
    daysAgo: 0,
    meal: 'breakfast',
    label: 'Overnight oats',
    kind: 'recipe',
    recipeKey: 'overnight-oats',
    servings: 1,
  },
  {
    daysAgo: 0,
    meal: 'snack',
    label: 'Banana',
    kind: 'food',
    seedKey: 'banana',
    quantity: 1,
    unit: 'piece',
  },
  {
    daysAgo: 0,
    meal: 'lunch',
    label: 'Greek salad',
    kind: 'recipe',
    recipeKey: 'greek-salad',
    servings: 1,
  },
  // Yesterday
  {
    daysAgo: 1,
    meal: 'breakfast',
    label: 'Porridge oats',
    kind: 'food',
    seedKey: 'oats-rolled',
    quantity: 60,
    unit: 'g',
  },
  {
    daysAgo: 1,
    meal: 'breakfast',
    label: 'Semi-skimmed milk',
    kind: 'food',
    seedKey: 'milk-semi-skimmed',
    quantity: 200,
    unit: 'ml',
  },
  {
    daysAgo: 1,
    meal: 'lunch',
    label: 'Pasta puttanesca',
    kind: 'recipe',
    recipeKey: 'pasta-puttanesca',
    servings: 1,
  },
  {
    daysAgo: 1,
    meal: 'dinner',
    label: 'Chickpea and spinach curry',
    kind: 'recipe',
    recipeKey: 'chickpea-curry',
    servings: 1.5,
  },
  {
    daysAgo: 1,
    meal: 'snack',
    label: 'Greek yoghurt',
    kind: 'food',
    seedKey: 'yoghurt-greek-natural',
    quantity: 150,
    unit: 'g',
  },
  // Two days ago
  {
    daysAgo: 2,
    meal: 'breakfast',
    label: 'Wholemeal toast',
    kind: 'food',
    seedKey: 'bread-wholemeal',
    quantity: 2,
    unit: 'piece',
  },
  {
    daysAgo: 2,
    meal: 'breakfast',
    label: 'Peanut butter',
    kind: 'food',
    seedKey: 'peanut-butter',
    quantity: 20,
    unit: 'g',
  },
  {
    daysAgo: 2,
    meal: 'dinner',
    label: 'Salmon and rice bowl',
    kind: 'recipe',
    recipeKey: 'salmon-rice-bowl',
    servings: 1,
  },
  {
    daysAgo: 2,
    meal: 'snack',
    label: 'Apple',
    kind: 'food',
    seedKey: 'apple',
    quantity: 1,
    unit: 'piece',
  },
  // Three days ago
  {
    daysAgo: 3,
    meal: 'breakfast',
    label: 'Banana oat pancakes',
    kind: 'recipe',
    recipeKey: 'banana-oat-pancakes',
    servings: 1,
  },
  {
    daysAgo: 3,
    meal: 'lunch',
    label: 'Minestrone',
    kind: 'recipe',
    recipeKey: 'minestrone',
    servings: 1.5,
  },
  {
    daysAgo: 3,
    meal: 'dinner',
    label: 'Lasagne alla bolognese',
    kind: 'recipe',
    recipeKey: 'lasagne',
    servings: 1,
  },
  // Four days ago
  {
    daysAgo: 4,
    meal: 'breakfast',
    label: 'Overnight oats',
    kind: 'recipe',
    recipeKey: 'overnight-oats',
    servings: 1,
  },
  {
    daysAgo: 4,
    meal: 'dinner',
    label: 'Shakshuka',
    kind: 'recipe',
    recipeKey: 'shakshuka',
    servings: 1.5,
  },
  {
    daysAgo: 4,
    meal: 'snack',
    label: 'Cheddar',
    kind: 'food',
    seedKey: 'cheese-cheddar',
    quantity: 30,
    unit: 'g',
  },
  // Five days ago
  {
    daysAgo: 5,
    meal: 'lunch',
    label: 'Tarka dal',
    kind: 'recipe',
    recipeKey: 'tarka-dal',
    servings: 1,
  },
  {
    daysAgo: 5,
    meal: 'dinner',
    label: 'Chicken and potato traybake',
    kind: 'recipe',
    recipeKey: 'chicken-traybake',
    servings: 1,
  },
  // Six days ago
  {
    daysAgo: 6,
    meal: 'breakfast',
    label: 'Wholemeal toast',
    kind: 'food',
    seedKey: 'bread-wholemeal',
    quantity: 2,
    unit: 'piece',
  },
  {
    daysAgo: 6,
    meal: 'dinner',
    label: 'Spinach and feta filo pie',
    kind: 'recipe',
    recipeKey: 'spinach-feta-pie',
    servings: 1,
  },
]

/**
 * The foods the household "added" themselves, so the app shows the contrast
 * the Catalog rules depend on: these are editable and carry Attribution,
 * while everything from `CATALOG_FOODS` is read-only and owned by nobody.
 *
 * One per value of `nutritionSource`, because a preview is where the
 * distinction has to be visible before anything is built on it — and the two
 * fields answering different questions is exactly what is easy to miss:
 * `source` says where the row came from, `nutritionSource` where its figures
 * did. The estimated one is a row somebody added by hand whose *numbers* a
 * model guessed, which is the pair that would collapse if they were one field.
 */
export const SAMPLE_USER_FOODS = [
  {
    name: 'Nora’s granola',
    brand: 'Homemade',
    icon: '🥣',
    baseUnit: 'g' as const,
    nutritionPer100: {
      calories: 471,
      protein: 10.2,
      carbs: 54.3,
      sugars: 18.7,
      fat: 22.6,
      saturatedFat: 4.1,
      fiber: 7.8,
      salt: 0.1,
    },
    // A food somebody authored, with the servings they actually think in — so
    // a preview shows the chips rather than an empty row where they should be.
    servings: [
      { label: '1 bowl', amount: 50 },
      { label: '1 small handful', amount: 20 },
      { label: 'over yoghurt', amount: 35 },
    ],
    source: 'manual' as const,
    nutritionSource: 'manual' as const,
  },
  {
    // Scanned in the shop and taken as it came: the row and its figures both
    // come from Open Food Facts.
    //
    // The barcode is deliberately a GS1 in-store code (prefix 2), never issued
    // to a real retail product, rather than this product's actual EAN. The
    // sample is wiped and recreated, but a *user-created* row is preserved —
    // so a real EAN here would collide with one a developer had already scanned
    // on dev, and `foods.getByBarcode` uses `.unique()`, which throws on two
    // matches. That would break barcode lookup for that product until the
    // sample was reset. A code no real packet carries cannot collide.
    name: 'Roomboter ontbijtkoek',
    brand: 'Peijnenburg',
    icon: '🍞',
    barcode: '2000000000017',
    baseUnit: 'g' as const,
    nutritionPer100: {
      calories: 328,
      protein: 4.6,
      carbs: 70.2,
      sugars: 32.4,
      fat: 2.4,
      saturatedFat: 1.3,
      fiber: 3.1,
      salt: 0.75,
    },
    servings: [{ label: '1 plak', amount: 25 }],
    source: 'openfoodfacts' as const,
    nutritionSource: 'imported' as const,
  },
  {
    // A store brand nobody has filed: added by hand, with figures nobody
    // typed — the case #86's AI routes exist for, shown here as the record
    // they leave behind.
    name: 'Bakery seeded spelt loaf',
    brand: 'Buurtbakker',
    icon: '🥖',
    baseUnit: 'g' as const,
    nutritionPer100: {
      calories: 259,
      protein: 9.4,
      carbs: 42.1,
      sugars: 2.8,
      fat: 4.6,
      saturatedFat: 0.8,
      fiber: 6.2,
      salt: 1.1,
    },
    servings: [{ label: '1 slice', amount: 40 }],
    source: 'manual' as const,
    nutritionSource: 'ai' as const,
  },
]

// ---------------------------------------------------------------------------
// Finances
// ---------------------------------------------------------------------------

/**
 * The Finances Module's sample content.
 *
 * A House with a real three-part mortgage is the fixture that matters: the
 * Module's central claim is that a mortgage is not one loan (ADR-0025), and a
 * preview showing a single annuity would quietly contradict it. One part is
 * fixed with a rate the household entered for when it expires, one is linear,
 * one is interest-only and ends first — so the timeline has steps in it.
 *
 * Every date is an offset from the run, like everything else here.
 */
export const SAMPLE_HOUSE = {
  name: 'Willowstraat 21',
  /** What the household last said it is worth, and how long ago they said it. */
  valueCents: 452_000_00,
  valuedDaysAgo: 55,
  boughtDaysAgo: 1_880,
}

export interface SampleLoanPart {
  kind: 'annuity' | 'linear' | 'interestOnly'
  principalCents: number
  annualRatePercent: number
  termMonths: number
  /** Months from the run until the fix ends. Absent means variable. */
  fixedInMonths?: number
  expiryRatePercent?: number
  expiryRateOptions?: number[]
  repayments?: {
    kind: 'once' | 'monthly'
    amountCents: number
    /** Months from the run. */
    inMonths: number
  }[]
  charge?: { freeAnnualPercent: number; chargePercent: number }
}

export interface SampleMortgage {
  name: string
  author: SampleAuthor
  parts: SampleLoanPart[]
}

export const SAMPLE_MORTGAGES: SampleMortgage[] = [
  {
    name: 'What we pay now',
    author: 'owner',
    parts: [
      {
        kind: 'annuity',
        principalCents: 180_000_00,
        annualRatePercent: 3.9,
        termMonths: 264,
        fixedInMonths: 58,
        expiryRatePercent: 5,
        expiryRateOptions: [3.9, 5, 6.5],
        charge: { freeAnnualPercent: 10, chargePercent: 1.5 },
      },
      {
        kind: 'linear',
        principalCents: 95_000_00,
        annualRatePercent: 2.15,
        termMonths: 168,
        fixedInMonths: 91,
        expiryRatePercent: 4,
      },
      {
        kind: 'interestOnly',
        principalCents: 70_000_00,
        annualRatePercent: 4.4,
        termMonths: 114,
      },
    ],
  },
  {
    name: 'If we overpay €300 a month',
    author: 'nora',
    parts: [
      {
        kind: 'annuity',
        principalCents: 180_000_00,
        annualRatePercent: 3.9,
        termMonths: 264,
        fixedInMonths: 58,
        expiryRatePercent: 5,
        repayments: [{ kind: 'monthly', amountCents: 300_00, inMonths: 2 }],
        charge: { freeAnnualPercent: 10, chargePercent: 1.5 },
      },
      {
        kind: 'linear',
        principalCents: 95_000_00,
        annualRatePercent: 2.15,
        termMonths: 168,
        fixedInMonths: 91,
        expiryRatePercent: 4,
      },
      {
        kind: 'interestOnly',
        principalCents: 70_000_00,
        annualRatePercent: 4.4,
        termMonths: 114,
      },
    ],
  },
]

/** Netherlands-specific, and every figure is one the household entered. */
export const SAMPLE_BUYING_COSTS = {
  purchasePriceCents: 425_000_00,
  ownMoneyCents: 45_000_00,
  mortgageCents: 380_000_00,
  mortgageRatePercent: 3.9,
  mortgageTermMonths: 360,
  transferTaxBand: 'ownHome' as const,
  transferTaxPercent: 2,
  lines: {
    notary: 1_650_00,
    valuation: 650_00,
    mortgageAdvice: 2_700_00,
    structuralSurvey: 450_00,
    buyingAgent: 3_900_00,
  },
}

export interface SampleRecurringCost {
  name: string
  amountCents: number
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'halfYearly' | 'yearly'
  category:
    | 'housing'
    | 'utilities'
    | 'insurance'
    | 'transport'
    | 'health'
    | 'media'
    | 'other'
  note?: string
  /** Percent per housemate. Absent means the cost is not divided. */
  split?: { author: SampleAuthor; percent: number }[]
  author: SampleAuthor
}

export const SAMPLE_RECURRING_COSTS: SampleRecurringCost[] = [
  {
    name: 'Mortgage payment',
    amountCents: 2_140_00,
    frequency: 'monthly',
    category: 'housing',
    split: [
      { author: 'owner', percent: 55 },
      { author: 'nora', percent: 45 },
    ],
    author: 'owner',
  },
  {
    name: 'Home insurance',
    amountCents: 222_00,
    frequency: 'yearly',
    category: 'housing',
    split: [
      { author: 'owner', percent: 50 },
      { author: 'nora', percent: 50 },
    ],
    author: 'nora',
  },
  {
    name: 'Energy',
    amountCents: 186_00,
    frequency: 'monthly',
    category: 'utilities',
    split: [
      { author: 'owner', percent: 55 },
      { author: 'nora', percent: 45 },
    ],
    author: 'owner',
  },
  {
    name: 'Water',
    amountCents: 96_00,
    frequency: 'quarterly',
    category: 'utilities',
    split: [
      { author: 'owner', percent: 55 },
      { author: 'nora', percent: 45 },
    ],
    author: 'sam',
  },
  {
    name: 'Internet',
    amountCents: 44_00,
    frequency: 'monthly',
    category: 'utilities',
    split: [
      { author: 'owner', percent: 50 },
      { author: 'nora', percent: 50 },
    ],
    author: 'nora',
  },
  {
    name: 'Health insurance',
    amountCents: 148_00,
    frequency: 'monthly',
    category: 'health',
    note: 'Two people, own risk €385',
    split: [
      { author: 'owner', percent: 50 },
      { author: 'nora', percent: 50 },
    ],
    author: 'owner',
  },
  {
    name: 'Car insurance',
    amountCents: 624_00,
    frequency: 'yearly',
    category: 'transport',
    note: 'Renews in March — WA + casco',
    split: [{ author: 'nora', percent: 100 }],
    author: 'nora',
  },
  {
    name: 'Streaming',
    amountCents: 15_99,
    frequency: 'monthly',
    category: 'media',
    author: 'sam',
  },
]

export interface SampleSavingsGoal {
  name: string
  targetCents: number
  savedCents: number
  monthlyCents?: number
  /** Months from the run. */
  targetInMonths: number
  author: SampleAuthor
}

export const SAMPLE_SAVINGS_GOALS: SampleSavingsGoal[] = [
  {
    name: 'New kitchen',
    targetCents: 15_000_00,
    savedCents: 6_400_00,
    monthlyCents: 300_00,
    targetInMonths: 19,
    author: 'owner',
  },
  {
    name: 'Trip to Japan',
    targetCents: 6_000_00,
    savedCents: 5_450_00,
    monthlyCents: 250_00,
    targetInMonths: 5,
    author: 'nora',
  },
]

export interface SampleHoldingTransaction {
  kind: 'buy' | 'sell' | 'dividend' | 'fee' | 'adjustment'
  daysAgo: number
  units?: number
  pricePerUnitCents?: number
  perUnitCents?: number
  feeCents?: number
  note?: string
}

export interface SampleHolding {
  kind: 'stock' | 'etf'
  symbol: string
  name: string
  exchange: string
  currency: string
  openingDaysAgo: number
  openingUnits: number
  openingAverageCostCents: number
  lastPriceCents: number
  /** Hours before the run the price is as at. */
  pricedHoursAgo: number
  transactions: SampleHoldingTransaction[]
  author: SampleAuthor
}

export const SAMPLE_HOLDINGS: SampleHolding[] = [
  {
    kind: 'etf',
    symbol: 'IWDA',
    name: 'iShares Core MSCI World',
    exchange: 'AMS',
    currency: 'EUR',
    openingDaysAgo: 600,
    openingUnits: 184,
    openingAverageCostCents: 9_750,
    lastPriceCents: 10_842,
    pricedHoursAgo: 3,
    transactions: [
      {
        kind: 'buy',
        daysAgo: 210,
        units: 20,
        pricePerUnitCents: 10_150,
        feeCents: 250,
      },
      { kind: 'dividend', daysAgo: 95, perUnitCents: 42 },
    ],
    author: 'owner',
  },
  {
    kind: 'stock',
    symbol: 'ASML',
    name: 'ASML Holding NV',
    exchange: 'AMS',
    currency: 'EUR',
    openingDaysAgo: 420,
    openingUnits: 12,
    openingAverageCostCents: 61_240,
    lastPriceCents: 65_100,
    pricedHoursAgo: 3,
    transactions: [
      {
        kind: 'buy',
        daysAgo: 160,
        units: 3,
        pricePerUnitCents: 64_000,
        feeCents: 250,
      },
      { kind: 'sell', daysAgo: 60, units: 3, pricePerUnitCents: 66_800 },
    ],
    author: 'nora',
  },
  {
    // A foreign holding, so the preview shows a conversion and its own age.
    kind: 'stock',
    symbol: 'AAPL',
    name: 'Apple Inc.',
    exchange: 'NASDAQ',
    currency: 'USD',
    openingDaysAgo: 300,
    openingUnits: 9,
    openingAverageCostCents: 25_000,
    lastPriceCents: 27_310,
    pricedHoursAgo: 5,
    transactions: [
      {
        kind: 'adjustment',
        daysAgo: 84,
        units: 9,
        pricePerUnitCents: 25_000,
        note: 'Broker corrected the opening lot',
      },
    ],
    author: 'sam',
  },
]

/** The Group counts in euros, and one manual conversion for the dollar holding. */
export const SAMPLE_FINANCE_SETTINGS = {
  homeCurrency: 'EUR',
  rates: [{ currency: 'USD', rate: 0.873, hoursAgo: 8 }],
}

export const SAMPLE_NET_WORTH_ENTRIES: {
  kind: 'asset' | 'liability'
  label: string
  amountCents: number
}[] = [
  { kind: 'asset', label: 'Savings account', amountCents: 21_400_00 },
  { kind: 'liability', label: 'Student loan', amountCents: 6_550_00 },
]

// ---------------------------------------------------------------------------
// Tasting subjects and Tastings (#199)
// ---------------------------------------------------------------------------

/**
 * What Willow Street has tasted, and what each of them thought.
 *
 * Three Kinds, because a preview that only showed cheese would not show that
 * the Kind spec is data — the whole reason there are three Modules and not
 * one. Every subject has at least one Tasting, because a subject exists
 * *because* somebody logged against it; a preview containing a subject nobody
 * tasted would show a state the app cannot otherwise reach.
 *
 * Two of them carry a `catalogKey`, so a preview shows what a materialised
 * catalog entry looks like beside a hand-typed one (`Boerenkaas Remeker` and
 * every wine and beer). None of them carries a photo: the seed writes straight
 * to the table and has no bytes to upload, and an empty photo tile is the
 * honest state rather than a missing one.
 */
export interface SampleTastingSubject {
  key: string
  kind: 'cheese' | 'wine' | 'beer'
  name: string
  /** Absent where the household typed the name themselves. */
  catalogKey?: string
  attributes: Record<string, string | number | string[]>
  tastings: SampleTasting[]
}

export interface SampleTasting {
  by: SampleAuthor
  rating: number
  /** Offset from the run, so Saturday's dinner stays recent. */
  daysAgo: number
  attributes: Record<string, string | number | string[]>
}

export const SAMPLE_TASTING_SUBJECTS: SampleTastingSubject[] = [
  {
    key: 'comte',
    kind: 'cheese',
    name: 'Comté 24 months',
    catalogKey: 'cheese-comte',
    attributes: {
      milk: 'cow',
      country: 'france',
      style: 'hard',
      producer: 'Marcel Petite',
      age: 24,
    },
    tastings: [
      {
        by: 'owner',
        rating: 4.5,
        daysAgo: 2,
        attributes: {
          firmness: 4,
          saltiness: 3,
          aromas: ['nutty', 'caramel', 'hay'],
          notes:
            'The crystals are back in this batch. Buy the same wheel again.',
        },
      },
      {
        by: 'nora',
        rating: 4.5,
        daysAgo: 16,
        attributes: {
          firmness: 5,
          saltiness: 3,
          aromas: ['nutty', 'crystalline'],
        },
      },
      {
        by: 'sam',
        rating: 4,
        daysAgo: 58,
        attributes: {
          firmness: 4,
          saltiness: 2,
          aromas: ['hay', 'butter'],
          notes: 'Younger wheel, softer. Fine but not the one.',
        },
      },
    ],
  },
  {
    key: 'roquefort',
    kind: 'cheese',
    name: 'Roquefort Papillon',
    catalogKey: 'cheese-roquefort',
    attributes: {
      milk: 'sheep',
      country: 'france',
      style: 'blue',
      producer: 'Papillon',
    },
    tastings: [
      {
        by: 'nora',
        rating: 4,
        daysAgo: 9,
        attributes: {
          firmness: 2,
          saltiness: 5,
          aromas: ['sharp', 'butter'],
          notes: 'Too salty on its own, excellent with the pear.',
        },
      },
    ],
  },
  {
    key: 'remeker',
    kind: 'cheese',
    // Typed by hand: a local cheese is as first-class as a famous one
    // (story 4), and it has no catalog key to carry.
    name: 'Boerenkaas Remeker',
    attributes: {
      milk: 'cow',
      country: 'netherlands',
      style: 'hard',
      producer: 'Remeker',
      age: 12,
    },
    tastings: [
      {
        by: 'owner',
        rating: 3.5,
        daysAgo: 5,
        attributes: {
          firmness: 4,
          saltiness: 2,
          aromas: ['grassy', 'butter'],
        },
      },
    ],
  },
  {
    key: 'barolo',
    kind: 'wine',
    name: 'Vajra Barolo 2019',
    attributes: {
      producer: 'G.D. Vajra',
      vintage: 2019,
      grapes: ['nebbiolo'],
      region: 'piedmont',
      style: 'red',
      abv: 14.5,
    },
    tastings: [
      {
        by: 'nora',
        rating: 4.5,
        daysAgo: 1,
        attributes: {
          sweetness: 1,
          acidity: 4,
          tannin: 5,
          body: 4,
          aromas: ['cherry', 'leather', 'violet', 'tar'],
          notes:
            'Still tight. Worth keeping the second bottle another three years.',
        },
      },
      {
        by: 'owner',
        rating: 4.5,
        daysAgo: 1,
        attributes: {
          sweetness: 1,
          acidity: 4,
          tannin: 4,
          body: 5,
          aromas: ['cherry', 'tobacco'],
        },
      },
    ],
  },
  {
    key: 'chablis',
    kind: 'wine',
    name: 'Laroche Chablis 2022',
    attributes: {
      producer: 'Domaine Laroche',
      vintage: 2022,
      grapes: ['chardonnay'],
      region: 'burgundy',
      style: 'white',
      abv: 12.5,
    },
    tastings: [
      {
        by: 'owner',
        rating: 4,
        daysAgo: 12,
        attributes: {
          sweetness: 1,
          acidity: 5,
          body: 2,
          aromas: ['citrus', 'apple', 'mineral'],
          notes: 'Bought two more.',
        },
      },
    ],
  },
  {
    key: 'vinho-verde',
    kind: 'wine',
    name: 'Vinho Verde, house',
    attributes: {
      grapes: ['loureiro'],
      region: 'minho',
      style: 'white',
      abv: 10,
    },
    tastings: [
      {
        by: 'sam',
        rating: 2.5,
        daysAgo: 21,
        attributes: {
          sweetness: 2,
          acidity: 4,
          body: 1,
          aromas: ['citrus'],
          notes: 'Fine on a terrace, forgettable at the table.',
        },
      },
    ],
  },
  {
    key: 'westmalle',
    kind: 'beer',
    name: 'Westmalle Tripel',
    attributes: { brewery: 'Westmalle', style: 'tripel', abv: 9.5 },
    tastings: [
      {
        by: 'owner',
        rating: 4.5,
        daysAgo: 3,
        attributes: {
          bitterness: 3,
          body: 4,
          aromas: ['banana', 'clove', 'honey'],
          notes: 'The one to keep in the house.',
        },
      },
      {
        by: 'nora',
        rating: 4,
        daysAgo: 30,
        attributes: { bitterness: 3, body: 4, aromas: ['clove', 'bread'] },
      },
    ],
  },
  {
    key: 'jopen',
    kind: 'beer',
    name: 'Jopen Hoppenbier',
    attributes: { brewery: 'Jopen', style: 'amberAle', abv: 6.8 },
    tastings: [
      {
        by: 'sam',
        rating: 3.5,
        daysAgo: 7,
        attributes: {
          bitterness: 4,
          body: 3,
          // A descriptor the shipped vocabulary does not have (story 11) —
          // so a preview proves the chips are a prompt and not a gate.
          aromas: ['citrus', 'pine', 'orange peel'],
        },
      },
    ],
  },
]
