/**
 * The phone's one door to the backend's generated types.
 *
 * `convex/` is not a workspace package, so the phone reaches it by relative
 * path — once, here — and every screen imports `api`, `Doc` and `Id` from this
 * module ([repo layout](../../../../docs/standards/repo-layout.md)). Biome
 * refuses a deep `convex/_generated` import anywhere else in `apps/mobile`.
 */
export { api } from '../../../../convex/_generated/api'
export type { Doc, Id } from '../../../../convex/_generated/dataModel'
