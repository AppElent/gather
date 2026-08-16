# Can Gather create or update an Albert Heijn shopping list through an API?

Research date: **2026-08-15**. Scope: the officially supported, authorised route
for a third-party application to write to a customer's Albert Heijn (AH) shopping
list. Only first-party AH sources are used.

## Verdict

**Not through a publicly documented, self-service API.** Albert Heijn's public
material does, however, describe an authorised third-party integration: an **AH
button** embedded as an **iframe** on *selected* partner websites. Clicking it adds
products to the customer's AH shopping list. AH does not publish endpoint,
authentication, onboarding, or partner-approval documentation for that integration.

So for Gather the practical answer is:

- **Do not build against private AH app/web endpoints.** That would not be a
  documented integration and AH's app terms prohibit reverse engineering.
- **A supported integration may be possible only with AH's explicit partner
  approval**, using their supplied AH-button/iframe implementation. Treat it as a
  partner-business-development request, not an API integration that we can start by
  registering an app or issuing an OAuth client.
- Until that approval and technical material exist, Gather should retain an internal
  shopping list and offer an export/share flow rather than promise AH list sync.

## Evidence

1. AH's current privacy policy explicitly says it enables adding products from
   **selected third-party sites**, gives examples (A-brand suppliers and recipe sites
   such as Smulweb), and describes the mechanism: an **"AH-knop"** that adds the
   product to the customer's list, with AH placing an **iframe** on the third-party
   site. It also says AH records which partner site was the source. This establishes
   an official, consent-aware partner flow, but its scope is selected sites rather
   than any developer.
   [Albert Heijn Privacy Policy, section 4.3.2.12](https://www.ah.nl/privacy/online-diensten).
   The versioned [14 May 2025 policy PDF, p. 29](https://static.ah.nl/binaries/ah/content/assets/ah-nl/core/legal/privacy/20250514-privacybeleid-ah-nl.pdf)
   independently contains the same wording.

2. The same policy identifies the shopping list as a feature of the customer's AH
   account and says AH processes the list (and, where used, its route order) with the
   customer's consent. This means an integration is acting on account-linked personal
   data and needs an AH-supplied, user-facing authorisation path rather than Gather
   collecting customer credentials.
   [Albert Heijn Privacy Policy, sections 4.3.2.1 and 4.3.2.12](https://www.ah.nl/privacy/online-diensten).

3. AH's current general terms state that users may not disassemble, decompile, or
   reverse-engineer the AH app. Therefore observing and reusing undocumented mobile
   app calls is not an acceptable fallback when no public API is available.
   [Albert Heijn General Terms, supplementary AH App terms](https://www.ah.nl/algemene-voorwaarden).

## What is and is not known from official material

| Question | Finding |
| --- | --- |
| Can a third-party site add products to an AH list? | Yes, through AH's iframe-based AH button **when it is one of AH's selected partner sites**. |
| Is there a public REST/GraphQL API, developer portal, OAuth scope, API key, or public onboarding path for it? | **None found in AH's public first-party materials** as of the research date. Absence of public documentation does not rule out a private partner API. |
| Can Gather create named lists, read a list, delete items, mark items complete, or continuously synchronise one? | **Not established.** The official wording supports adding products; it does not document those broader list-management operations. |
| Can we use the endpoints used by ah.nl or the AH app? | No. They are undocumented/private, and AH's terms prohibit reverse engineering the app. |

## Recommended next step

Contact Albert Heijn through its partnership/business channel and ask specifically
whether Gather can join the **AH-knop / third-party shopping-list** programme. Confirm:

1. eligibility and commercial/privacy requirements;
2. the supported integration format (iframe only, SDK, or API);
3. whether products can be matched from generic ingredients versus only AH product
   identifiers; and
4. supported operations beyond adding products, if any.

Do not commit to two-way list synchronisation unless AH documents and grants those
capabilities in writing.
