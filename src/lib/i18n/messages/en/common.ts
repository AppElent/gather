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

  /**
   * The emoji field a food and a one-off both use (#94).
   *
   * The emoji themselves are content and are never translated — they are
   * stored on the row, the way a serving's label is (ADR-0011). Only these
   * words around the grid are.
   */
  icon: {
    label: 'Icon',
    hint: 'Shown when there is no picture of this.',
    none: 'No icon',
  },

  /** The photo field a recipe and a child's profile both use. */
  image: {
    label: 'Photo',
    choose: 'Choose photo',
    replace: 'Replace photo',
    uploading: 'Uploading…',
    failed: 'Could not upload that image',
    remove: 'Remove photo',
    decodeFailed:
      'That image could not be opened in this browser. Try saving it as a JPEG and choosing it again.',
    prepareFailed:
      'That image could not be prepared. Try a smaller photo, or save it as a JPEG and choose it again.',
    frameTitle: 'Frame your photo',
    frameFree:
      'Drag to move the frame, or drag its corner to resize. Gather stores what is inside it.',
    frameSquare:
      'Drag to move the square, or drag its corner to resize. Gather stores what is inside it.',
    moveFrame: 'Move frame',
    resizeFrame: 'Resize frame',
    frameSize: 'Frame size',
    opening: 'Opening photo…',
    storedAs:
      'Stored as {width} × {height} — the photo on your phone is untouched.',
    use: 'Use photo',
    preparing: 'Preparing…',
  },
}
