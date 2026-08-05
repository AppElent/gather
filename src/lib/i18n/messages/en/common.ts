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
    saving: 'Saving…',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    confirm: 'Confirm',
    working: 'Working…',
    copy: 'Copy',
    copied: 'Copied!',
    retry: 'Try again',
    back: 'Back',
  },
  errors: {
    somethingWentWrong: 'Something went wrong. Please try again.',
    notFound: 'Not found.',
    loading: 'Loading…',
    didNotWork: 'That did not work — try again.',
  },

  /** The photo field a recipe and a child's profile both use. */
  image: {
    label: 'Photo',
    uploading: 'Uploading…',
    failed: 'Could not upload that image',
    remove: 'Remove photo',
  },
}
