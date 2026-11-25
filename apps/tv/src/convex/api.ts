/**
 * The TV app's one door to the backend's generated types, as on the phone
 * ([repo layout](../../../../docs/standards/repo-layout.md)). Biome refuses a
 * deep `convex/_generated` import anywhere else in `apps/tv`.
 */
export { api } from '../../../../convex/_generated/api'
