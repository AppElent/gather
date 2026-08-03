/**
 * The Group a new recipe will land in.
 *
 * Saving and importing both name their destination explicitly — the server
 * takes the slug and authorises it, and never falls back to a Group of its own
 * choosing. This is what that decision looks like on the way in, so that the
 * page can also *show* it: a route that decides silently is exactly the failure
 * #19 is about.
 */
export interface RecipeDestination {
  /** The Group's slug — what `recipes.create` and the import action are given. */
  groupSlug: string
  /** Its name, for saying out loud where the recipe is going. */
  groupName: string
  /**
   * True when the route named no Group and this is the caller's Personal group,
   * chosen for them. The flat `/recipes/new` route has nowhere else to get a
   * Group from; #24 deletes it, and this with it.
   */
  fallback: boolean
}
