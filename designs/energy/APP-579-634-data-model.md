# Energy follow-ups: data model (APP-579, 720, 721, 498, 499, 634)

Eric approved this on 27 Nov 2026, together with the screens in [followups_final.md](followups_final.md). Canvas page: https://claude.ai/artifact/CvdwtVyuoN1Da3u4EumKeM#page-e-dm.

## APP-579: rename or remove the address

There is no schema change.

- **Rename:** patches `energySites.name`, and sets or clears `houseId`.
- **Remove:** admins only. It deletes, in batches, every row with this `siteId`:
  - `energySources`, including their `secret`
  - `energyChannels`, `energyReadings` and `energyIntervals`
  - `energyContracts`
  - `energyPriceFeeds` and that feed's prices
  - the solar and battery assets

  Then it deletes the site itself. This follows the same pattern as Group deletion.
- One address per Group stays the rule in `createSite`.

## APP-720: a Home Assistant statistic outside the dashboard

There is no schema change.

A channel the Member adds is a normal `energyChannels` row:
- `sourceId` is the Home Assistant source.
- `externalRef` is the statistic id.

The server checks three things:
- The unit fits the kind.
- A tariff is set only for electricity, and `total` is never mixed with `low`/`normal`.
- `(sourceId, externalRef)` is unique within the site.

## APP-721: meter swap

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `energyChannels.retiredReason` (new) | `v.optional(v.union(v.literal('haCovered'), v.literal('meterSwap')))` | no | Why the channel is retired |
| `energyChannels.replacedByChannelId` (new) | `v.optional(v.id('energyChannels'))` | no | The new meter's channel |

- A channel with `retiredAt` but no `retiredReason` means `haCovered`, the legacy meaning.
- Disconnecting Home Assistant restores only `haCovered` channels. A `meterSwap` channel stays retired.
- There is no backfill, because every channel retired today is `haCovered`.
- The export includes both fields.
- It is OTA-safe: installed phones ignore the fields.

## APP-498: HomeWizard on the phone

`energySources.kind` already has `'homeWizard'`. The other changes:

- `energySources.secret` holds the local token per meter. It stays server-only, as it is today.
- New table `energyHomeWizardDevices`:

  | Field | Type |
  | --- | --- |
  | `sourceId` | `v.id('energySources')` |
  | `serial` | `v.string()` |
  | `productType` | `v.string()` |
  | `lastIp` | `v.optional(v.string())` |
  | `lastReadAt` | `v.optional(v.number())` |
  | `lastReadByUserId` | `v.optional(v.id('users'))` |

- A query scoped to Members gives their phones the token and the last IP, for their own Group only.
- A mutation `ingestLocal` takes counter readings with their time and turns them into intervals. A gap becomes one block.
- It needs native work: the Local Network permission and Bonjour (`_hwenergy._tcp`). That means a store build, so it cannot ship as an OTA update.

## APP-499: cheapest-hours notification

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `memberships.energyCheapestPush` (new) | `v.optional(v.object({ blockHours: 1–4, includeNegative: v.boolean() }))` | no | No field means off |

- There is a new `NotificationKind`, `energyCheapestHours`. The existing switches and mute rules apply to it.
- The action that fetches tomorrow's prices schedules one send per opted-in Member, with `dedupeKey` `energyCheapest:<date>`. So a Member gets at most one a day.

## APP-634: export credit and export charge (expand, then contract)

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `energyContracts.exportCreditEurPerKwh` (new) | `v.optional(v.number())`, ≥ 0 | no | What the supplier pays per exported kWh |
| `energyContracts.exportChargeEurPerKwh` (new) | `v.optional(v.number())`, ≥ 0 | no | What the supplier charges per exported kWh |

- **Backfill:** once, with a dry run first.
  - An old `exportFeeEurPerKwh` above 0 becomes the credit.
  - Below 0, it becomes the charge, stored as a positive number.
  - A value of 0 sets both to 0.
- **Expand phase:** `exportFeeEurPerKwh` stays. Every save also writes it as credit minus charge, so installed phones keep calculating.
- **Contract phase:** remove `exportFeeEurPerKwh` only once every phone runs a build that has the new fields.
- **Costs:** they use credit minus charge, with net metering too.
