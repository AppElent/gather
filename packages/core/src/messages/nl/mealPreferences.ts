import type { Messages } from '../en'

export const mealPreferences = {
  title: 'Eetvoorkeuren',
  subhead:
    'Voor heel {group}. Gather gebruikt dit bij zelf kiezen, Plan mijn week en Iets anders.',
  closing:
    'Iedereen in {group} kan dit aanpassen; wijzigingen gelden meteen. Eetvoorkeuren gaan mee in de export van je gegevens.',
  saveFailed: 'Opslaan lukte niet. Probeer het opnieuw.',

  dayShort: ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'],
  dayLong: [
    'maandag',
    'dinsdag',
    'woensdag',
    'donderdag',
    'vrijdag',
    'zaterdag',
    'zondag',
  ],

  who: {
    heading: 'Wie eet mee',
    eatsByDefault: 'Eet standaard mee',
    notByDefault: 'Eet standaard niet mee',
    servings: 'Porties per maaltijd',
    servingsSame: 'Standaard gelijk aan wie mee-eet ({count})',
    servingsAdjusted: 'Aangepast; standaard eten mee: {count}',
    servingsReset: 'Gelijk aan wie mee-eet',
    footnote:
      'Eet iemand een keer niet mee? Tik op die maaltijd in het weekmenu. Een afspraak in de agenda zet het al voor je klaar.',
  },
  plan: {
    heading: 'Wat plannen',
    slots: { breakfast: 'Ontbijt', lunch: 'Lunch', dinner: 'Avondeten' },
    onChosenDays: 'Op de gekozen dagen',
    footnote:
      'Alleen wat aan staat krijgt een plek in het weekmenu en in Plan mijn week.',
  },
  time: {
    heading: 'Kooktijd per dag',
    none: 'geen',
    minutes: '{minutes}',
    cellLabel: '{day}: hooguit {minutes} minuten',
    cellLabelNone: '{day}: geen maximum',
    hint: 'Wijzigt de tijd',
    footnote:
      'Tik op een dag om de maximale tijd te wijzigen. Op een drukke avond in de agenda kiest Gather iets snels, wat hier ook staat.',
  },
  diet: {
    heading: 'Dieet',
    names: {
      vegetarian: 'Vegetarisch',
      vegan: 'Veganistisch',
      pescatarian: 'Pescotarisch',
      'gluten-free': 'Glutenvrij',
      'lactose-free': 'Lactosevrij',
      halal: 'Halal',
    },
    footnote: 'Geldt voor de hele groep. Niets gekozen: alles mag.',
  },
  allergies: {
    heading: 'Allergieën',
    names: {
      gluten: 'Gluten',
      crustaceans: 'Schaaldieren',
      eggs: 'Eieren',
      fish: 'Vis',
      peanuts: 'Pinda',
      soy: 'Soja',
      milk: 'Melk',
      nuts: 'Noten',
      celery: 'Selderij',
      mustard: 'Mosterd',
      sesame: 'Sesam',
      sulphites: 'Sulfiet',
      lupin: 'Lupine',
      molluscs: 'Weekdieren',
    },
    footnote:
      'Gather slaat een recept over als het ingrediënt er herkenbaar in staat. Bij twijfel staat er "controleer zelf" bij. Kijk bij een allergie altijd zelf het etiket na.',
  },
  dislikes: {
    heading: 'Liever niet',
    placeholder: 'Toevoegen, bijvoorbeeld koriander',
    remove: '{name} verwijderen',
    empty: 'Nog niets.',
    tooMany: 'Meer past er niet in deze lijst.',
  },
  variety: {
    heading: 'Afwisseling',
    noRepeat: 'Zelfde recept niet binnen',
    noRepeatValue: { one: '{count} dag', other: '{count} dagen' },
    meatFree: 'Vleesloze avonden',
    meatFreeValue: { one: '{count} per week', other: '{count} per week' },
    fishNight: 'Visavond',
    fishNightSub: 'Gather plant dan bij voorkeur vis',
    decrease: 'Minder',
    increase: 'Meer',
  },
  leftovers: {
    heading: 'Restjes',
    cookDouble: 'Kook dubbel op',
    footnote:
      'Op deze dagen kookt Gather voor meer porties. De dag erna wordt "Restjes", tenzij daar al iets staat.',
  },
  extra: {
    heading: 'Extra',
    budget: 'Weekbudget',
    budgetLabel: 'Weekbudget in euro',
    budgetNone: 'Geen',
    budgetPlaceholder: 'Geen',
    budgetInvalid: 'Vul een bedrag in, bijvoorbeeld 85 of 85,50.',
    cuisines: 'Favoriete keukens',
    cuisinesSub: 'Komen vaker voor in voorstellen',
    cuisineNames: {
      italian: 'Italiaans',
      mexican: 'Mexicaans',
      asian: 'Aziatisch',
      dutch: 'Hollands',
      'middle-eastern': 'Midden-Oosters',
      indian: 'Indiaas',
    },
    footnote:
      'Budget telt alleen mee als recepten een prijs hebben. Zonder budget let Gather er niet op.',
  },
  smart: {
    heading: 'Slimme voorstellen',
    useStock: 'Gebruik wat in huis is',
    useCalendar: 'Houd rekening met de agenda',
    preferHighRated: 'Liever hoog beoordeeld',
    subs: {
      useStock: 'Recepten met wat bijna op is gaan voor',
      useCalendar: 'Drukke avonden krijgen iets snels',
      preferHighRated: 'En wat lang niet gegeten is',
    },
    footnote:
      'Plan mijn week, Iets anders en Nieuw idee kosten elk 1 slimme actie uit je eigen daglimiet van 30. Zelf kiezen met deze filters is altijd gratis.',
  },

  filter: {
    chip: 'Volgens voorkeuren',
    hidden: {
      one: '{count} recept verborgen door jullie voorkeuren ({reasons}). Tik Volgens voorkeuren om het te zien.',
      other:
        '{count} recepten verborgen door jullie voorkeuren ({reasons}). Tik Volgens voorkeuren om ze te zien.',
    },
    contains: 'Bevat {term}',
    containsDislike: 'Bevat {term}, staat bij liever niet',
    notDiet: 'Niet {diet}: {term}',
    tooLong: 'Duurt {minutes} min, die dag hooguit {limit}',
    checkYourself: 'controleer zelf',
    checkYourselfFor: 'Controleer zelf: {what}',
  },
} satisfies Messages['mealPreferences']
