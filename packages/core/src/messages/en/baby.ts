import type { BabyEventType } from '../../domain'

/**
 * The names of the eight things a log entry can be.
 *
 * They used to be `BABY_EVENT_LABELS` in `convex/lib/babyEvents.ts`, and unlike
 * the nutrient and meal labels one Convex function *did* read them —
 * `activity.ts` put one in each entry's `title`. That was the backend choosing
 * a display word, so it now sends the type key instead and the client looks it
 * up here (ADR-0011).
 */
export const eventTypes = {
  temperature: 'Temperature',
  feeding: 'Feeding',
  diaper: 'Diaper',
  sleep: 'Sleep',
  growth: 'Growth',
  medication: 'Medication',
  vaccination: 'Vaccination',
  note: 'Note',
  memory: 'Memory',
} satisfies Record<BabyEventType, string>

export const log = {
  list: {
    subtitle:
      'Temperature, feeding, sleep, growth and more — shared with the group.',
    addChild: 'Add child',
    emptyTitle: 'No children yet',
    emptyBody:
      'Add a child to start logging temperature, feeding, sleep and more.',
    emptyAction: 'Add your first child',
  },

  child: {
    age: {
      days: { one: '{count} day old', other: '{count} days old' },
      weeks: { one: '{count} week old', other: '{count} weeks old' },
      months: { one: '{count} month old', other: '{count} months old' },
      years: { one: '{count} year old', other: '{count} years old' },
      yearsMonths: '{years}y {months}m old',
    },
    notFound: 'Child not found.',
    switch: 'Switch child',
    edit: 'Edit {name}',
    settings: 'Child settings',
    todo: 'To-do',
    todoPlaceholder: 'Buy diapers, call pediatrician…',
    questions: 'Questions',
    questionsPlaceholder: 'Ask about sleep regression…',
    addTo: 'Add to {list}',
    deleteTask: 'Delete {task}',
    temperatureTrend: 'Temperature trend',
    weightTrend: 'Weight trend',
    checklistEmpty: 'Nothing here — nice.',
    trendEmpty: 'Log at least two entries to see a trend line.',
    trendChart: 'Trend chart, {unit}, {count} points',
  },

  form: {
    name: 'Name',
    birthDate: 'Birth date',
    sex: 'Sex',
    sexUnspecified: 'Prefer not to say',
    sexFemale: 'Female',
    sexMale: 'Male',
    saveFailed: 'Could not save that child',
    detailsTitle: 'Details',
    createTitle: 'Add a child',
    editTitle: 'Edit {name}',
    deleteTitle: 'Delete {name}?',
    deleteBody:
      'Every entry logged for them goes too, for everyone in this group.',
    deleteConfirm: 'Delete {name}',
    deleteFailed: 'Could not delete that child.',
  },

  quickLog: {
    heading: 'Log an entry',
    /** The two list shortcuts at the end of the log bar. */
    addTodo: 'To-do',
    addQuestion: 'Question',
    todoPlaceholder: 'What needs doing?',
    questionPlaceholder: 'What do you want to ask?',
    addFailed: 'Could not add that',
    several: 'Log several',
  },

  /**
   * What a child's log offers, and the sentence that stops somebody thinking
   * they deleted a record (ADR-0022).
   */
  /** The tiles at the top of a Child's log, and the line under them. */
  status: {
    today: 'Today',
    ago: '{duration} ago',
    countToday: '{count} today',
    never: 'Nothing logged yet',
    at: 'at {time}',
    seeAll: 'See all {count} entries',
    weight: 'Weight',
    height: 'Height',
    head: 'Head circumference',
    temperature: 'Temperature',
    allTrends: 'All trends',
    sinceBirth: 'since birth',
    /** The number of points on the line, which is not a number of days. */
    measurements: '{count} measurements',
    noTrend: 'Two entries are needed before there is a line to draw.',
  },

  tracked: {
    title: "What's on the log bar",
    subtitle: "Choose what {name}'s log offers, and in what order.",
    settingsHint: 'Change it any time under Settings → Modules → Baby log.',
    keepsEntries:
      'Turning one off only changes what you are offered. Nothing already logged is hidden or deleted.',
    none: 'Nothing is being tracked for {name} yet.',
    countOf: '{count} of {total}',
    /** The arrows: this list's order is the order the log bar offers. */
    moveUp: 'Move {type} up',
    moveDown: 'Move {type} down',
    orderHint:
      'The order here is the order the log offers them in. Move the ones you use most to the top.',
    /** The same arrangement, from the log bar itself. */
    arrangeHold: 'Hold to rearrange',
    arrangeHint: 'Drag to rearrange',
  },

  /** The empty Module, which invites its first Child rather than a switch. */
  firstRun: {
    title: 'Baby log',
    body: 'Feeds, sleep, diapers, growth and the questions you keep meaning to ask the doctor — kept for one child, and shared with everyone in the household.',
    action: 'Add a child',
    goesIn: 'Goes in {group}',
  },

  /** Creating the first Child is the Module's setup, in three steps. */
  create: {
    step: 'Step {current} of {total}',
    next: 'Next',
    back: 'Back',
    cancel: 'Cancel',
    finish: 'Add {name}',
    aboutTitle: 'About the child',
    addPhoto: 'Add a photo',
    ageHint: '{age}',
    nameRequired: 'Enter a name',
    failed: 'Could not add that child',
  },

  /** The two checklist cards, and where their lists come from. */
  lists: {
    title: 'Lists',
    subtitle:
      'Two lists come with {name} — things to do, and the questions you want to ask at the next appointment. Both are ordinary task lists.',
    todos: 'To-dos',
    questions: 'Questions',
    newList: 'New list',
    newListHint: 'Created for {name}, local to Gather',
    choose: 'Choose an existing list',
    pickTodos: 'To-do list',
    pickQuestions: 'Questions list',
    anyListIn: 'Any list in {group}, whatever it runs on.',
    readOnly: '{provider} · read-only',
    readOnlyBody:
      '{provider} lists are read-only in Gather. You will see this list here, but you will not be able to add to it.',
    openCount: { one: '{count} open', other: '{count} open' },
    addTodo: 'Add a to-do',
    addQuestion: 'Add a question',
    done: 'Done',
  },

  entry: {
    logTitle: 'Log {type}',
    editTitle: 'Edit {type}',
    when: 'When',
    start: 'Start',
    notes: 'Notes',
    saveFailed: 'Could not save this entry',

    /**
     * The photo on an entry. Only Memory offers one today, and the wording
     * says "photo" rather than "image" because it comes off a camera roll.
     */
    photo: 'Photo',
    addPhoto: 'Add a photo',
    takePhoto: 'Take a photo',
    choosePhoto: 'Choose from library',
    replacePhoto: 'Replace photo',
    removePhoto: 'Remove photo',
    photoOf: 'Photo of this {type} entry',
    photoUploading: 'Uploading photo…',
    photoFailed: 'Could not add that photo',
    photoDenied: 'Gather needs permission to use that',

    /**
     * The When row, which opens rather than sitting open: most entries are
     * logged as they happen, and the ones that are not were usually a short
     * while ago.
     */
    editWhen: 'Change',
    today: 'Today',
    yesterday: 'Yesterday',
    date: 'Date',
    hour: 'Hour',
    minute: 'Min',
    earlierDay: 'Previous day',
    laterDay: 'Next day',
    earlierHour: 'An hour earlier',
    laterHour: 'An hour later',
    earlierMinute: 'Five minutes earlier',
    laterMinute: 'Five minutes later',
    /** The stepper buttons, which need a name each rather than "plus". */
    less: 'Less {field}',
    more: 'More {field}',
  },

  multi: {
    heading: 'Log several entries',
    when: 'When',
    include: 'Include',
    pickOne: 'Pick at least one thing to log.',
    save: { one: 'Save {count} entry', other: 'Save {count} entries' },
    partial: 'Saved {saved} of {total} entries — {detail}',
  },

  timeline: {
    /** Everything ever logged, which is emphatically not "Today". */
    title: 'All entries',
    empty: 'No entries yet — log the first one above.',
    /** A row is a way into the entry, so it needs saying what it opens. */
    openEntry: 'Open {type} entry',
    /** Deleted from another device while you were looking at it. */
    gone: 'This entry is no longer here.',
    deleteEntry: 'Delete {type} entry',
    deleteTitle: 'Delete this entry?',
    deleteConfirm: 'Delete entry',
    deleteFailed: 'Could not delete that entry.',
  },

  /** The type-specific half of an entry form. */
  fields: {
    temperature: 'Temperature (°C)',
    method: 'Method',
    notSpecified: 'Not specified',
    leftMin: 'Left (min)',
    rightMin: 'Right (min)',
    amountMl: 'Amount (ml)',
    amountG: 'Amount (g)',
    durationHours: 'Hours',
    durationMinutes: 'Minutes',
    end: 'End (optional)',
    kind: 'Kind',
    weightKg: 'Weight (kg)',
    heightCm: 'Height (cm)',
    headCm: 'Head circ. (cm)',
    medicationName: 'Name',
    doseAmount: 'Dose amount',
    doseUnit: 'Dose unit',
    doseUnitPlaceholder: 'ml, mg…',
    vaccineName: 'Vaccine name',
    milestone: 'Mark as a milestone',
    what: 'What happened',
    whatPlaceholder: 'First laugh, first steps…',
  },

  /** The vocabulary each of those selects offers. */
  options: {
    temperatureMethod: {
      oral: 'Oral',
      rectal: 'Rectal',
      axillary: 'Armpit',
      ear: 'Ear',
      forehead: 'Forehead',
    },
    feedingMethod: {
      breast: 'Breastfeeding',
      bottle: 'Bottle',
      solid: 'Solid food',
    },
    feedingSide: {
      left: 'Left',
      right: 'Right',
      both: 'Both',
    },
    diaperKind: {
      wet: 'Wet',
      dirty: 'Dirty',
      both: 'Both',
    },
  },

  /** What a form says when it cannot build an entry out of what was typed. */
  validation: {
    negativeMinutes: 'Minutes cannot be negative',
    selectTemperature: 'Select a temperature',
    enterMeasurement: 'Enter at least one measurement',
    enterMedicationName: 'Enter a medication name',
    enterVaccineName: 'Enter a vaccine name',
    enterMemoryWhat: 'Say what happened',
    /** A number typed past the bounds its own row declares. */
    outOfRange: '{field} must be between {min} and {max}',
  },

  /** The one-line summary under each timeline row, and in the PDF. */
  summary: {
    celsiusWithMethod: '{celsius}°C ({method})',
    celsius: '{celsius}°C',
    sideMinutes: '{side} {minutes}m',
    /**
     * Whole phrases per kind rather than "{kind} diaper": Dutch inflects the
     * adjective ("natte luier"), so a language that composes the two in English
     * cannot be assumed to compose them anywhere else.
     */
    diaper: {
      wet: 'Wet diaper',
      dirty: 'Dirty diaper',
      both: 'Wet and dirty diaper',
    },
    sleepFor: 'Sleep · {duration}',
    sleep: 'Sleep',
    headCircumference: 'head {value} cm',
    growth: 'Growth measurement',
    medication: 'Medication',
    vaccination: 'Vaccination',
    milestone: 'Milestone',
    note: 'Note',
    memory: 'Memory',
  },

  /** The PDF itself, which is a document a person reads like any other. */
  pdf: {
    title: '{name} — baby log',
    born: 'Born {date} · {age}',
    columnDate: 'Date',
    columnTime: 'Time',
    columnDetails: 'Details',
    columnEntries: 'Entries',
    columnNotes: 'Notes',
    empty: 'No entries in this date range.',
    fileNameFallback: 'baby',
  },

  export: {
    button: 'Export PDF',
    title: 'Export PDF',
    from: 'From',
    to: 'To',
    layout: 'Layout',
    byCategory: 'By category',
    chronological: 'Chronological',
    include: 'Include',
    download: 'Download PDF',
    generating: 'Generating…',
    failed: 'Could not generate the PDF',
  },
}

export const baby = { eventTypes, log }
