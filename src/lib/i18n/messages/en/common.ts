/**
 * The base vocabulary: words that mean the same thing wherever they appear.
 *
 * Anything that only ever reads correctly in one place belongs to that place's
 * file instead. A key here is a promise that the same English word is the right
 * word in every screen that reaches for it — which is why "Save" is here and
 * "Unpin" is not.
 */
export const common = {
  actions: {
    start: 'Start',
    cancel: 'Cancel',
    close: 'Close',
    save: 'Save',
    delete: 'Delete',
    copy: 'Copy',
    copied: 'Copied!',
    retry: 'Try again',
    back: 'Back',
  },
  errors: {
    somethingWentWrong: 'Something went wrong. Please try again.',
    notFound: 'Not found.',
    loading: 'Loading…',
  },
}
