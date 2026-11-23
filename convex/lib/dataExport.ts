/**
 * What "Export your data" contains, table by table.
 *
 * ## The registry cannot be forgotten
 *
 * `EXPORT_TABLES` is keyed by *every table in the schema*, so a new table fails
 * `pnpm typecheck` here until somebody states its export treatment — read for
 * the person, read per Group, or excluded with a reason. It is the third
 * registry built this way, after `GROUP_CONTENT` (`groupCascade.ts`) and
 * `FILE_HOLDERS` (`storedFiles.ts`), and it leans on both: a table with a
 * `groupId` (`GroupScopedTable`, which also keys the cascade) may only be
 * read per Group or excluded, and a photo column is found through
 * `storedFileIdsOf` rather than by guessing at `imageId ?? photoId`.
 *
 * ## Whose rows, and how much of them
 *
 * The scope is the person's own account and every Group they are a Member of
 * (docs/contracts/data-export.md). Inside a Group everything is shared by its
 * Members (ADR-0030), so a Group's content goes in whole. Three things do not:
 *
 * - **Another Member's own records.** The AI counter is read by the
 *   caller's own `userId` and nothing else, and another Member's
 *   membership row keeps only who they are and their role — their pins and
 *   calendar choices are theirs (ADR-0005).
 * - **Identifiers beyond a display name.** Every user id anywhere in a row is
 *   written as that person's name, so no email, Clerk id or user id leaves.
 * - **Secrets.** A connection's access token and a Group's invite code are
 *   omitted columns, listed in the file's header.
 *
 * ## Paging
 *
 * One page is one bounded server read: `PAGE_SIZE` rows from one index range.
 * A child table (tasks, calendar events, baby events) is paged
 * across its parents with a compound cursor, because Convex allows one
 * `paginate` per query and the parents are few. The cursor names its parent
 * by id, not by position, so a parent deleted mid-export cannot shift a later
 * one out of the file.
 */

import type {
  ExportExclusion,
  ExportManifest,
  ExportPage,
  ExportRow,
} from '@gather/core/data-export'
import { EXPORT_VERSION } from '@gather/core/data-export'
import { INVALID_EXPORT_CURSOR } from '@gather/core/refusals'
import type { PaginationOptions } from 'convex/server'
import { ConvexError } from 'convex/values'
import type { DataModel, Doc, Id, TableNames } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import type { GroupScopedTable } from './groupAccess'
import { storedFileIdsOf } from './storedFiles'

/** Rows read per page. Small enough for any table's largest row. */
export const PAGE_SIZE = 200

/**
 * Bytes one page reads at most, well inside a query's 16 MiB: 200 rows of a
 * table whose rows run large (a long note, a recipe with many steps) would not
 * be. A page that reaches it ends early and the cursor resumes after its last
 * row. A document is at most 1 MiB, so a page always makes progress.
 */
export const PAGE_BYTES = 4 * 1024 * 1024

export type ExportScope = 'account' | 'group'

/** Every table whose rows belong to one person rather than to a Group. */
type OwnTable = {
  [T in TableNames]: Doc<T> extends { userId: Id<'users'> }
    ? Doc<T> extends { groupId: Id<'groups'> }
      ? never
      : T
    : never
}[TableNames]

type Field<T extends TableNames> = keyof Doc<T> & string
type IndexOf<T extends TableNames> = keyof DataModel[T]['indexes'] & string

interface Shape<T extends TableNames> {
  /** Columns that never leave, stated in the file's `omittedFields`. */
  omit?: Field<T>[]
  /** A row that names somebody else here keeps only `othersSee`. */
  ownedBy?: { field: Field<T>; othersSee: Field<T>[] }
}

type Excluded = { exclude: ExportExclusion }

/** Read by the scope's own column — `groupId` or `userId` — on this index. */
type ByScope<T extends TableNames, S extends ExportScope> = Shape<T> & {
  scope: S
  index: IndexOf<T>
}

/** Read under each row of a parent table, which is itself read `ByScope`. */
type ByParent<T extends TableNames> = Shape<T> & {
  scope: ExportScope
  parent: TableNames
  index: IndexOf<T>
  field: Field<T>
}

/** The one row the scope *is*: the person, or the Group. */
type Self<T extends TableNames> = Shape<T> & { scope: ExportScope; self: true }

type ExportTreatment<T extends TableNames> = T extends GroupScopedTable
  ? ByScope<T, 'group'> | Excluded
  : T extends OwnTable
    ? ByScope<T, 'account'> | Excluded
    : ByParent<T> | Self<T> | Excluded

/**
 * Every table, and what the export does with it. Declaration order is file
 * order: account tables first, then each Group's, parents before children.
 */
const EXPORT_TABLES: { [T in TableNames]: ExportTreatment<T> } = {
  // -- The person ----------------------------------------------------------
  users: {
    scope: 'account',
    self: true,
    // The Clerk subject is an internal handle — the sign-in identity lives in
    // Clerk — and `deletedAt` is only ever set on an account mid-purge.
    omit: ['clerkId', 'deletedAt'],
  },
  aiUsage: { scope: 'account', index: 'by_user_and_day' },
  // A mirror of the login's Apple links, kept by Clerk's webhook so the web
  // can revoke Sign in with Apple (APP-388): Clerk's data, not Gather's, and
  // an identifier like the Clerk id the export never writes.
  appleSignInLinks: { exclude: 'bookkeeping' },
  // Retry receipts for connected apps' creates; the rows they point at go out.
  idempotencyKeys: { exclude: 'bookkeeping' },
  // A phone's push token and the sends queued for it: delivery plumbing, and
  // the token is a credential for reaching that phone (APP-298).
  pushDevices: { exclude: 'bookkeeping' },
  scheduledNotifications: { exclude: 'bookkeeping' },
  // Shared across every Group and keyed by a product name only: nobody's.
  groceryCategoryCache: { exclude: 'reference-data' },
  // One global counter per day of AI questions about grocery names.
  groceryAiUsage: { exclude: 'bookkeeping' },
  // The same counter per Group (APP-368): how many questions, never which.
  groceryAiGroupUsage: { exclude: 'bookkeeping' },

  // -- Each Group ----------------------------------------------------------
  groups: { scope: 'group', self: true, omit: ['inviteCode', 'isPersonal'] },
  memberships: {
    scope: 'group',
    index: 'by_group',
    ownedBy: { field: 'userId', othersSee: ['userId', 'role'] },
  },
  recipes: { scope: 'group', index: 'by_group' },
  // An index of `recipes.sharedGroupIds`, which goes out with each recipe.
  recipeShares: { exclude: 'bookkeeping' },
  mealEntries: { scope: 'group', index: 'by_group' },
  plannedDinners: { scope: 'group', index: 'by_group' },
  mealPreferences: { scope: 'group', index: 'by_group' },
  // Plan mijn week's open proposal (APP-319): Group content for a day.
  mealPlanDrafts: { scope: 'group', index: 'by_group' },
  // The Pantry's rows until the contract step (APP-314), and the staples
  // they became: both go out, so nothing a Group typed is missing.
  pantryEntries: { scope: 'group', index: 'by_group' },
  groceryStaples: { scope: 'group', index: 'by_group' },
  taskLists: { scope: 'group', index: 'by_group' },
  tasks: {
    scope: 'group',
    parent: 'taskLists',
    index: 'by_list',
    field: 'listId',
  },
  // Who completed a repeating task and when (APP-303); names, never ids.
  taskCompletions: { scope: 'group', index: 'by_group' },
  groceryCategoryOverrides: { scope: 'group', index: 'by_group_and_name' },
  notes: { scope: 'group', index: 'by_group' },
  calendars: { scope: 'group', index: 'by_group' },
  calendarEvents: {
    scope: 'group',
    parent: 'calendars',
    index: 'by_calendar',
    field: 'calendarId',
  },
  babies: {
    scope: 'group',
    index: 'by_group',
    // The acceptances `untrackedTypes` replaced, read only by a migration.
    omit: ['trackedTypes'],
  },
  babyEvents: {
    scope: 'group',
    parent: 'babies',
    index: 'by_baby',
    field: 'babyId',
  },
  tastingSubjects: { scope: 'group', index: 'by_group' },
  tastings: { scope: 'group', index: 'by_group' },
  loyaltyCards: { scope: 'group', index: 'by_group' },
  houses: { scope: 'group', index: 'by_group' },
  mortgageCalculations: { scope: 'group', index: 'by_group' },
  loanParts: { scope: 'group', index: 'by_group' },
  homeBuyingCosts: { scope: 'group', index: 'by_group' },
  recurringCosts: { scope: 'group', index: 'by_group' },
  savingsGoals: { scope: 'group', index: 'by_group' },
  splitScenarios: { scope: 'group', index: 'by_group' },
  holdings: { scope: 'group', index: 'by_group' },
  holdingTransactions: { scope: 'group', index: 'by_group' },
  financeSettings: { scope: 'group', index: 'by_group' },
  netWorthEntries: { scope: 'group', index: 'by_group' },
  netWorthSnapshots: { scope: 'group', index: 'by_group' },
  // Energy (APP-491). A source's token and a price feed's key never leave;
  // market prices belong to no Group and account prices are the supplier's,
  // fetched again from the feed (`energyPrices` below).
  energySites: { scope: 'group', index: 'by_group' },
  energyContracts: { scope: 'group', index: 'by_group' },
  energySources: { scope: 'group', index: 'by_group', omit: ['secret'] },
  energyAssets: { scope: 'group', index: 'by_group' },
  energyChannels: { scope: 'group', index: 'by_group' },
  energyReadings: { scope: 'group', index: 'by_group' },
  energyIntervals: { scope: 'group', index: 'by_group' },
  energyPriceFeeds: { scope: 'group', index: 'by_group', omit: ['secret'] },
  integrationConnections: {
    scope: 'group',
    index: 'by_group_provider',
    // A live OAuth token for somebody's Notion or Todoist.
    omit: ['accessToken'],
  },

  // -- Not exported --------------------------------------------------------
  tastingCatalog: { exclude: 'reference-data' },
  retailerCatalog: { exclude: 'reference-data' },
  // Price slots: a market price is the same for every Group and belongs to
  // none; an account price is the supplier's own, a cache of its feed that
  // carries no Group id to scope it by (APP-491).
  energyPrices: { exclude: 'reference-data' },
  seedRuns: { exclude: 'bookkeeping' },
}

type Included = Exclude<ExportTreatment<TableNames>, Excluded>

function treatmentOf(table: TableNames) {
  return EXPORT_TABLES[table] as Included | Excluded
}

function isIncluded(t: Included | Excluded): t is Included {
  return !('exclude' in t)
}

/** The tables in the file, the ones left out, and the columns left out. */
export function exportLayout() {
  const account: TableNames[] = []
  const group: TableNames[] = []
  const excluded: { table: string; reason: ExportExclusion }[] = []
  const omittedFields: Record<string, string[]> = {}
  for (const table of Object.keys(EXPORT_TABLES) as TableNames[]) {
    const treatment = treatmentOf(table)
    if (!isIncluded(treatment)) {
      excluded.push({ table, reason: treatment.exclude })
      continue
    }
    ;(treatment.scope === 'account' ? account : group).push(table)
    if (treatment.omit?.length) omittedFields[table] = [...treatment.omit]
  }
  return { account, group, excluded, omittedFields }
}

// -- Reading -----------------------------------------------------------------

type Row = Record<string, unknown> & { _id: string; _creationTime: number }

/**
 * The slice of a query the registry needs, over a table chosen at runtime.
 * The schema's own types cannot follow a table name that is a variable, so
 * this is the one place that says what is being relied on.
 */
interface RangeQuery extends AsyncIterable<Row> {
  collect(): Promise<Row[]>
  take(n: number): Promise<Row[]>
  paginate(options: PaginationOptions): Promise<{
    page: Row[]
    isDone: boolean
    continueCursor: string
  }>
}
interface TableQuery extends RangeQuery {
  withIndex(
    index: string,
    range: (q: { eq(field: string, value: unknown): unknown }) => unknown,
  ): RangeQuery
  filter(
    predicate: (q: {
      eq(a: unknown, b: unknown): unknown
      field(name: string): unknown
    }) => unknown,
  ): RangeQuery
}

function tableQuery(ctx: QueryCtx, table: TableNames) {
  return ctx.db.query(table) as unknown as TableQuery
}

/** What the scope column holds for this scope. */
interface Scope {
  scope: ExportScope
  me: Doc<'users'>
  group: Doc<'groups'> | null
}

function scopeRange(ctx: QueryCtx, table: TableNames, index: string, s: Scope) {
  const [field, value] =
    s.scope === 'group'
      ? ['groupId', (s.group as Doc<'groups'>)._id]
      : ['userId', s.me._id]
  return tableQuery(ctx, table).withIndex(index, (q) => q.eq(field, value))
}

/**
 * A compound cursor: which parent, and where inside its children.
 *
 * The parent is named by id, with its creation time for when it is gone: a
 * parent range is one `by_group` or `by_user` value, so it is in creation
 * order, and the first parent created after a deleted one is where to go on.
 */
interface ParentCursor {
  parent: string
  createdAt: number
  inner: string | null
}

/** A cursor this module handed out, or the keyed refusal for one it did not. */
function readParentCursor(cursor: string): ParentCursor {
  let at: unknown
  try {
    at = JSON.parse(cursor)
  } catch {
    throw new ConvexError(INVALID_EXPORT_CURSOR)
  }
  const c = at as Partial<ParentCursor> | null
  if (
    !c ||
    typeof c !== 'object' ||
    typeof c.parent !== 'string' ||
    typeof c.createdAt !== 'number' ||
    !(c.inner === null || typeof c.inner === 'string')
  ) {
    throw new ConvexError(INVALID_EXPORT_CURSOR)
  }
  return c as ParentCursor
}

function parentCursor(parent: Row, inner: string | null): ParentCursor {
  return { parent: parent._id, createdAt: parent._creationTime, inner }
}

async function readRaw(
  ctx: QueryCtx,
  table: TableNames,
  treatment: Included,
  s: Scope,
  cursor: string | null,
): Promise<{ rows: Row[]; cursor: string | null; isDone: boolean }> {
  if ('self' in treatment) {
    const row = s.scope === 'account' ? s.me : s.group
    return {
      rows: row ? [row as unknown as Row] : [],
      cursor: null,
      isDone: true,
    }
  }

  if ('parent' in treatment) {
    const parentTreatment = treatmentOf(treatment.parent)
    if (!isIncluded(parentTreatment) || !('index' in parentTreatment)) {
      throw new Error(`Export parent ${treatment.parent} is not read by index`)
    }
    const parents = await scopeRange(
      ctx,
      treatment.parent,
      parentTreatment.index,
      s,
    ).collect()
    const at = cursor ? readParentCursor(cursor) : null
    let index = 0
    let inner: string | null = null
    if (at) {
      index = parents.findIndex((p) => p._id === at.parent)
      if (index >= 0) inner = at.inner
      // Deleted since the last page: go on with the next one created.
      else index = parents.findIndex((p) => p._creationTime > at.createdAt)
    }
    const parent = index >= 0 ? parents[index] : undefined
    if (!parent) return { rows: [], cursor: null, isDone: true }
    const page = await tableQuery(ctx, table)
      .withIndex(treatment.index, (q) => q.eq(treatment.field, parent._id))
      .paginate({
        numItems: PAGE_SIZE,
        cursor: inner,
        maximumBytesRead: PAGE_BYTES,
      })
    const following = parents[index + 1]
    const next = !page.isDone
      ? parentCursor(parent, page.continueCursor)
      : following
        ? parentCursor(following, null)
        : null
    return {
      rows: page.page,
      cursor: next && JSON.stringify(next),
      isDone: next === null,
    }
  }

  const page = await scopeRange(ctx, table, treatment.index, s).paginate({
    numItems: PAGE_SIZE,
    cursor,
    maximumBytesRead: PAGE_BYTES,
  })
  return { rows: page.page, cursor: page.continueCursor, isDone: page.isDone }
}

// -- Writing a row -------------------------------------------------------------

/** How ids that are not content are written: people by name, Groups by slug. */
interface References {
  people: Map<string, string>
  groups: Map<string, string>
}

/** The display names of the Group's Members — or only the person's own. */
async function referencesFor(ctx: QueryCtx, s: Scope): Promise<References> {
  const people = new Map<string, string>([[s.me._id, s.me.name]])
  if (s.group) {
    const members = await ctx.db
      .query('memberships')
      .withIndex('by_group', (q) =>
        q.eq('groupId', (s.group as Doc<'groups'>)._id),
      )
      .collect()
    for (const member of members) {
      const user = await ctx.db.get(member.userId)
      if (user) people.set(user._id, user.name)
    }
  }

  const groups = new Map<string, string>()
  const memberships = await ctx.db
    .query('memberships')
    .withIndex('by_user', (q) => q.eq('userId', s.me._id))
    .collect()
  for (const membership of memberships) {
    const group = await ctx.db.get(membership.groupId)
    if (group) groups.set(group._id, group.slug)
  }
  return { people, groups }
}

/**
 * Rewrite one value for the file. A user id becomes a name (or `null`, for
 * somebody not in this Group); a Group id becomes a slug, or is dropped when it
 * is not one of the person's Groups. Everything else is content and passes
 * through.
 */
function rewrite(ctx: QueryCtx, refs: References, value: unknown): unknown {
  if (typeof value === 'string') {
    if (ctx.db.normalizeId('users', value))
      return refs.people.get(value) ?? null
    if (ctx.db.normalizeId('groups', value)) return refs.groups.get(value)
    return value
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => rewrite(ctx, refs, item))
      .filter((item) => item !== undefined)
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, inner] of Object.entries(value)) {
      const next = rewrite(ctx, refs, inner)
      if (next !== undefined) out[key] = next
    }
    return out
  }
  return value
}

async function project(
  ctx: QueryCtx,
  table: TableNames,
  treatment: Included,
  s: Scope,
  refs: References,
  row: Row,
): Promise<ExportRow> {
  const owner = treatment.ownedBy
  if (owner && row[owner.field] !== s.me._id) {
    const out: ExportRow = {}
    for (const field of owner.othersSee)
      out[field] = rewrite(ctx, refs, row[field])
    return out
  }

  const implied = s.scope === 'group' ? 'groupId' : 'userId'
  const omit = new Set<string>(treatment.omit ?? [])
  const files: unknown[] = storedFileIdsOf(
    table,
    row as unknown as Doc<typeof table>,
  )
  const out: ExportRow = {
    id: row._id,
    addedAt: new Date(row._creationTime).toISOString(),
  }
  for (const [key, value] of Object.entries(row)) {
    if (key === '_id' || key === '_creationTime' || key === implied) continue
    if (omit.has(key)) continue
    if (files.includes(value)) {
      out[key.replace(/Id$/, 'Url')] = await ctx.storage.getUrl(
        value as Id<'_storage'>,
      )
      continue
    }
    const next = rewrite(ctx, refs, value)
    if (next !== undefined) out[key] = next
  }
  return out
}

/**
 * One page of one table, for the person or for one of their Groups. The caller
 * has already established who the person is and that they are in `group`.
 */
export async function readExportPage(
  ctx: QueryCtx,
  args: {
    table: string
    me: Doc<'users'>
    group: Doc<'groups'> | null
    cursor: string | null
  },
): Promise<ExportPage> {
  const table = args.table as TableNames
  const treatment = table in EXPORT_TABLES ? treatmentOf(table) : null
  const scope: ExportScope = args.group ? 'group' : 'account'
  if (!treatment || !isIncluded(treatment) || treatment.scope !== scope) {
    throw new Error('Not an exported table')
  }

  const s: Scope = { scope, me: args.me, group: args.group }
  const raw = await readRaw(ctx, table, treatment, s, args.cursor)
  const refs = await referencesFor(ctx, s)
  const rows: ExportRow[] = []
  for (const row of raw.rows) {
    rows.push(await project(ctx, table, treatment, s, refs, row))
  }
  return { rows, cursor: raw.isDone ? null : raw.cursor, isDone: raw.isDone }
}

/**
 * What is in the person's export: the tables, in file order, and their Groups
 * by name. `dataExport.manifest` returns it as is; the account portal walks the
 * same steps (`convex/accountPortal.ts`).
 */
export async function exportManifest(
  ctx: QueryCtx,
  me: Doc<'users'>,
): Promise<ExportManifest> {
  const groups = (await exportGroups(ctx, me)).map((g) => ({
    slug: g.slug,
    name: g.name,
  }))
  return { version: EXPORT_VERSION, ...exportLayout(), groups }
}

/** The person's Groups in export order: by name. */
export async function exportGroups(
  ctx: QueryCtx,
  me: Doc<'users'>,
): Promise<Doc<'groups'>[]> {
  const memberships = await ctx.db
    .query('memberships')
    .withIndex('by_user', (q) => q.eq('userId', me._id))
    .collect()
  const groups: Doc<'groups'>[] = []
  for (const membership of memberships) {
    const group = await ctx.db.get(membership.groupId)
    if (group) groups.push(group)
  }
  return groups.sort((a, b) => a.name.localeCompare(b.name))
}

/** Whether a count may go on: asked before each index range and each row. */
export interface ReadGuard {
  mayOpen: () => Promise<boolean>
  mayReadRow: () => Promise<boolean>
}

/**
 * The rows of one index range, read one at a time while `guard` allows it, so
 * that no row's size can take the query past its limits. The caller learns
 * that the range was cut short from the guard.
 */
export async function* guardedRows<T>(
  range: () => AsyncIterable<T>,
  guard: ReadGuard,
): AsyncGenerator<T> {
  if (!(await guard.mayOpen())) return
  const rows = range()[Symbol.asyncIterator]()
  try {
    while (await guard.mayReadRow()) {
      const next = await rows.next()
      if (next.done) return
      yield next.value
    }
  } finally {
    // A range left early stays open on the server until it is closed.
    await rows.return?.()
  }
}

/**
 * How many of one Group's rows of `table` the export would hold, reading at
 * most `limit` of them, on the index the registry names. A child table is
 * counted across its parents, as it is paged. For the account portal's
 * `summary`, which caps every count rather than reading a whole table; `guard`
 * may stop it earlier.
 */
export async function countGroupRows(
  ctx: QueryCtx,
  args: {
    table: TableNames
    me: Doc<'users'>
    group: Doc<'groups'>
    limit: number
    guard: ReadGuard
  },
): Promise<number> {
  const { table, limit, guard } = args
  const treatment = treatmentOf(table)
  if (!isIncluded(treatment) || treatment.scope !== 'group') {
    throw new Error(`${table} is not exported per Group`)
  }
  const s: Scope = { scope: 'group', me: args.me, group: args.group }
  if ('self' in treatment) return 1

  let count = 0
  const add = async (range: () => RangeQuery) => {
    if (count >= limit) return
    for await (const _ of guardedRows(range, guard)) {
      count++
      if (count >= limit) return
    }
  }
  if (!('parent' in treatment)) {
    await add(() => scopeRange(ctx, table, treatment.index, s))
    return count
  }
  const { parent: parentTable, index, field } = treatment
  const parentTreatment = treatmentOf(parentTable)
  if (!isIncluded(parentTreatment) || !('index' in parentTreatment)) {
    throw new Error(`Export parent ${parentTable} is not read by index`)
  }
  const parents = guardedRows(
    () => scopeRange(ctx, parentTable, parentTreatment.index, s),
    guard,
  )
  for await (const parent of parents) {
    await add(() =>
      tableQuery(ctx, table).withIndex(index, (q) => q.eq(field, parent._id)),
    )
    if (count >= limit) break
  }
  return count
}
