import type { EnergyRefusalCode } from '../../refusals'

/**
 * Every word the Energy Module says (APP-492).
 *
 * A site's name is content ("Thuis", "Vakantiehuis") and is never in here; the
 * default the form offers is, because it is a suggestion in the reader's
 * language (ADR-0011). Vocabulary: `designs/energy/README.md`.
 */
export const energy = {
  /** The summary under the large title while the Group has no address. */
  empty: {
    summary: 'No address yet',
    sub: 'Usage, costs and prices per hour',
    title: 'What does your power cost, every hour?',
    body: 'See what your home uses, produces and pays, with the price of every hour. Solar panels and a home battery too.',
    next: 'Start with your address. Then connect Home Assistant or type in meter readings.',
    action: 'Add your first address',
  },
  /** Adding an address: the empty Module's form (ADR-0022). */
  form: {
    addressHeading: 'Address',
    name: 'Name',
    /** What the name field starts with. Content once saved. */
    defaultName: 'Home',
    house: 'House',
    houseNone: 'None (optional)',
    houseHint:
      'Link a house from Finances to see energy next to your mortgage. Not needed.',
    sourceHeading: 'How does your data come in?',
    /** The radio group's name, for a screen reader. */
    sourceLabel: 'Source',
    homeAssistant: 'Connect Home Assistant',
    homeAssistantHint:
      'Per hour, with solar and battery. HomeWizard and Zonneplan in Home Assistant work too.',
    manual: 'Type meter readings',
    manualHint: 'Estimated per day. A good way to start.',
    submit: 'Continue',
    saving: 'Saving…',
    // The design's footnote ("Prices work right away, no key needed…") comes
    // back with prices themselves (APP-493); until then it would promise
    // something the Module cannot do yet.
  },
  /** An address that exists, before the screens that fill it (APP-493..496). */
  site: {
    sourceNone: 'No source connected yet',
    sourceManual: 'Meter readings',
    /** The label a meter-readings source is saved with. Content once saved. */
    manualSourceLabel: 'Meter readings',
    nextTitle: 'Coming next',
    nextHomeAssistant:
      'Connecting Home Assistant arrives in an update soon. Until then this address has no usage yet.',
    nextManual:
      'Typing meter readings arrives in an update soon. Until then this address has no usage yet.',
  },
  refusals: {
    needsName: 'Give the address a name.',
    tooLong: 'That name is too long.',
    houseNotFound: 'That house is not in this Group any more.',
    notFound: 'That address is not in this Group.',
  } satisfies Record<EnergyRefusalCode, string>,
}
