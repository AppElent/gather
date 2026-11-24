# Recorded price answers (APP-493)

Read by `energyPrices.test.ts`. `energyzero-*.json` are answers of
`public.api.energyzero.nl/public/v1/prices`, recorded on 23 November 2026 and
cut down to the `base` prices Gather reads (the autumn one to 25 October 2026,
the day of 25 hours).

ENTSO-E and Tibber answer prices only to a key, so theirs cannot be recorded
here. The tests build those documents from the published formats; their
refusals are the real answers to no key.
