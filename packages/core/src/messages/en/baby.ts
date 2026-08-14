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
    several: 'Log several',
  },

  entry: {
    logTitle: 'Log {type}',
    editTitle: 'Edit {type}',
    when: 'When',
    start: 'Start',
    notes: 'Notes',
    saveFailed: 'Could not save this entry',
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
    empty: 'No entries yet — log the first one above.',
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
