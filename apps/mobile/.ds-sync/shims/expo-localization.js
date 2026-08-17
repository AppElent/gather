// Browser shim: the preview always renders in the source language.
export function getLocales() {
  return [
    {
      languageTag: 'en-US',
      languageCode: 'en',
      regionCode: 'US',
      textDirection: 'ltr',
    },
  ]
}

export function getCalendars() {
  return [{ calendar: 'gregory', timeZone: 'UTC' }]
}
