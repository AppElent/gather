/**
 * A calendar heading from a localised date: only the first letter is a capital.
 * Dutch writes weekdays and months in lowercase ("woensdag 18 november"), so a
 * heading wants "Woensdag 18 november", not the "Woensdag 18 November" that
 * `textTransform: 'capitalize'` gives by capitalising every word.
 */
export function headingCase(text: string, locale: string) {
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1)
}
