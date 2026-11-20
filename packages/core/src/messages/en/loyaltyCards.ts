import type { BarcodeFormat, BarcodeProblem } from '../../barcodes'
import type { RetailerCategory } from '../../loyaltyCards'
import type { LoyaltyCardRefusalCode } from '../../refusals'

/**
 * Every word the Loyalty cards Module says (APP-141).
 *
 * A store's name is content and is never in here: Albert Heijn is Albert
 * Heijn in both languages, and so is the bakery somebody typed (ADR-0011).
 * Barcode format names are technical labels printed the same everywhere.
 */
export const loyaltyCards = {
  /** A store tile's logo, for a screen reader. `{store}` is the store's name. */
  logoAlt: '{store} logo',
  index: {
    /** The summary under the index's large title. */
    count: { one: '{count} card', other: '{count} cards' },
    subtitle: 'Store cards the whole household can use.',
    add: 'Add card',
    filter: 'Filter cards',
    clearFilter: 'Clear filter',
    filterEmpty: 'No card matches that.',
    neverUsed: 'Not used yet',
    usedAt: 'Last used: {when}',
    emptyTitle: 'No cards yet',
    emptyBody:
      'Add the store cards your household uses, and anyone in {group} can show them at the till.',
    emptyAction: 'Add your first card',
    /** Rearranging the Group's cards (APP-440). One order for the household. */
    reorder: 'Reorder',
    reorderDone: 'Done',
    /** The phone's banner in reorder mode, before `reorderShared`. */
    reorderHint: 'Drag a card by its handle.',
    reorderShared:
      'Everyone in {group} sees this order. A card added later goes on top.',
    /** A grip's name for a screen reader. `{store}` is the store's name. */
    reorderDrag: 'Reorder {store}',
    moveUp: 'Move {store} up',
    moveDown: 'Move {store} down',
  },
  picker: {
    title: 'Add a card',
    searchLabel: 'Find your store',
    searchPlaceholder: 'Albert Heijn, Kruidvat, IKEA…',
    noMatches: 'No store matches “{query}”.',
    matchCount: 'Stores found: {count}.',
    otherStore: 'Other store',
    otherStoreHint: 'Not in the list? Add it by name.',
    changeStore: 'Change store',
  },
  form: {
    createTitle: 'Add a card',
    editTitle: 'Edit {store}',
    storeName: 'Store',
    cardNumber: 'Card number',
    cardNumberHintLength: '{length} characters.',
    cardNumberHintPrefix: 'Usually starts with {prefix}.',
    barcodeFormat: 'Barcode type',
    formatGuess:
      'We are not sure which barcode {store} uses. If the till cannot scan it, try another type.',
    holder: 'Whose card',
    holderHint: 'Optional, for example a name.',
    note: 'Note',
    color: 'Colour',
    frontPhoto: 'Front of the card',
    backPhoto: 'Back of the card',
    preview: 'Preview',
    save: 'Save card',
    waitingForPhoto: 'Waiting for the photo…',
    saveFailed: 'The card could not be saved.',
    deleteTitle: 'Delete the {store} card?',
    deleteBody:
      'It goes for everyone in the household, with its photos. This cannot be undone.',
    deleteConfirm: 'Delete card',
    deleteFailed: 'The card could not be deleted.',
    problems: {
      empty: 'Enter the card number.',
      characters: 'This barcode type cannot hold those characters.',
      length: 'That number is the wrong length for this barcode type.',
      checkDigit:
        'The last digit does not match. Check the number on the card.',
    } satisfies Record<BarcodeProblem, string>,
  },
  detail: {
    notFound: 'This card is not in this household.',
    showAtTill: 'Show this at the till',
    cardNumber: 'Card number',
    note: 'Note',
    photos: 'Photos',
    lastUsed: 'Last used',
    barcodeLabel: '{format} barcode for {store}',
    drawing: 'Drawing the barcode…',
    drawFailed:
      'This barcode could not be drawn. The card number is below, so the cashier can type it in.',
  },
  formats: {
    EAN_13: 'EAN-13',
    EAN_8: 'EAN-8',
    UPC_A: 'UPC-A',
    UPC_E: 'UPC-E',
    CODE_128: 'Code 128',
    CODE_39: 'Code 39',
    CODE_93: 'Code 93',
    CODABAR: 'Codabar',
    ITF: 'ITF',
    QR: 'QR code',
    PDF417: 'PDF417',
    AZTEC: 'Aztec',
    DATA_MATRIX: 'Data Matrix',
  } satisfies Record<BarcodeFormat, string>,
  categories: {
    supermarket: 'Supermarket',
    wholesale: 'Wholesale',
    liquor: 'Liquor store',
    drugstore: 'Drugstore',
    health: 'Health store',
    beauty: 'Beauty',
    diy: 'DIY',
    garden: 'Garden',
    home: 'Home',
    fashion: 'Fashion',
    electronics: 'Electronics',
    books: 'Books',
    sports: 'Sports',
    toys: 'Toys',
    pets: 'Pets',
    department: 'Department store',
    fuel: 'Fuel',
    mobility: 'Mobility',
    programme: 'Savings programme',
  } satisfies Record<RetailerCategory, string>,
  /** Keyed by the wire kind, `loyalty:<code>`, for `errorMessage`. */
  refusals: {
    'loyalty:notFound': 'This card is not in this household any more.',
    'loyalty:needsStore': 'Enter the store’s name.',
    'loyalty:tooLong': 'One of the fields is too long.',
    'loyalty:brandColor': 'That colour is not valid.',
    'loyalty:unknownRetailer':
      'That store is no longer in the list. Choose it again or add it as another store.',
    'loyalty:cardNumber:empty': 'Enter the card number.',
    'loyalty:cardNumber:characters':
      'This barcode type cannot hold those characters.',
    'loyalty:cardNumber:length':
      'That number is the wrong length for this barcode type.',
    'loyalty:cardNumber:checkDigit':
      'The last digit does not match. Check the number on the card.',
  } satisfies Record<`loyalty:${LoyaltyCardRefusalCode}`, string>,
}
