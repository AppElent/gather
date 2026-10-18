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
 * `groupId` (`GroupScopedTable`, the cascade's own derivation) may only be read
 * per Group or excluded, and a photo column is found through `storedFileIdOf`
 * rather than by guessing at `imageId ?? photoId`.
 *
 * ## Whose rows, and how much of them
 *
 * The scope is the person's own account and every Group they are a Member of
 * (docs/contracts/data-export.md). Inside a Group everything is shared by its
 * Members (ADR-0030), so a Group's content goes in whole. Three things do not:
 *
 * - **Another Member's personal records.** The diary, combos and AI counter are
 *   read by the caller's own `userId` and nothing else, and another Member's
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
 * A child table (tasks, calendar events, baby events, combo items) is paged
 * across its parents with a compound cursor, because Convex allows one
 * `paginate` per query and the parents are few.
 */

import type {
  ExportExclusion,
  ExportPage,
  ExportRow,
} from '@gather/core/data-export'
import type { PaginationOptions } from 'convex/server'
import type { DataModel, Doc, Id, TableNames } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import type { GroupScopedTable } from './groupCascade'
import { storedFileIdOf } from './storedFiles'

/** Rows read per page. Small enough for any table's largest row. */
export const PAGE_SIZE = 200

/**
 * Rows scanned per page when the table has no index on the person — only
 * `foods`, which is mostly the Catalog and other people's imports.
 */
const SCAN_ROWS_PER_PAGE = 2000

export type ExportScope = 'account' | 'group'

/** Every table whose rows belong to one person rather than to a Group. */
type PersonalTable = {
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

/** Every row the person created, found by scanning. */
type Authored<T extends TableNames> = Shape<T> & {
  scope: 'account'
  authoredBy: Field<T>
}

type ExportTreatment<T extends TableNames> = T extends GroupScopedTable
  ? ByScope<T, 'group'> | Excluded
  : T extends PersonalTable
    ? ByScope<T, 'account'> | Excluded
    : ByParent<T> | Self<T> | Authored<T> | Excluded

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
  consumptionEntries: { scope: 'account', index: 'by_user_date' },
  combos: { scope: 'account', index: 'by_user' },
  comboItems: {
    scope: 'account',
    parent: 'combos',
    index: 'by_combo',
    field: 'comboId',
  },
  aiUsage: { scope: 'account', index: 'by_user_and_day' },
  // Foods belong to nobody's Group: a person's own are the ones they created.
  foods: {
    scope: 'account',
    authoredBy: 'createdBy',
    omit: ['searchText', 'seedKey'],
  },

  // -- Each Group ----------------------------------------------------------
  groups: { scope: 'group', self: true, omit: ['inviteCode', 'isPersonal'] },
  memberships: {
    scope: 'group',
    index: 'by_group',
    ownedBy: { field: 'userId', othersSee: ['userId', 'role'] },
  },
  recipes: { scope: 'group', index: 'by_group' },
  mealEntries: { scope: 'group', index: 'by_group' },
  plannedDinners: { scope: 'group', index: 'by_group' },
  pantryEntries: { scope: 'group', index: 'by_group' },
  taskLists: { scope: 'group', index: 'by_group' },
  tasks: {
    scope: 'group',
    parent: 'taskLists',
    index: 'by_list',
    field: 'listId',
  },
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
  integrationConnections: {
    scope: 'group',
    index: 'by_group_provider',
    // A live OAuth token for somebody's Notion or Todoist.
    omit: ['accessToken'],
  },

  // -- Not exported --------------------------------------------------------
  tastingCatalog: { exclude: 'reference-data' },
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
interface RangeQuery {
  collect(): Promise<Row[]>
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

/** A compound cursor: which parent, and where inside its children. */
interface ParentCursor {
  parent: number
  inner: string | null
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

  if ('authoredBy' in treatment) {
    const field = treatment.authoredBy
    const page = await tableQuery(ctx, table)
      .filter((q) => q.eq(q.field(field), s.me._id))
      .paginate({
        numItems: PAGE_SIZE,
        cursor,
        maximumRowsRead: SCAN_ROWS_PER_PAGE,
      })
    return { rows: page.page, cursor: page.continueCursor, isDone: page.isDone }
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
    const at: ParentCursor = cursor
      ? (JSON.parse(cursor) as ParentCursor)
      : { parent: 0, inner: null }
    const parent = parents[at.parent]
    if (!parent) return { rows: [], cursor: null, isDone: true }
    const page = await tableQuery(ctx, table)
      .withIndex(treatment.index, (q) => q.eq(treatment.field, parent._id))
      .paginate({ numItems: PAGE_SIZE, cursor: at.inner })
    const next: ParentCursor = page.isDone
      ? { parent: at.parent + 1, inner: null }
      : { parent: at.parent, inner: page.continueCursor }
    return {
      rows: page.page,
      cursor: JSON.stringify(next),
      isDone: next.parent >= parents.length,
    }
  }

  const page = await scopeRange(ctx, table, treatment.index, s).paginate({
    numItems: PAGE_SIZE,
    cursor,
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
  const file = storedFileIdOf(table, row as unknown as Doc<typeof table>)
  const out: ExportRow = {
    id: row._id,
    addedAt: new Date(row._creationTime).toISOString(),
  }
  for (const [key, value] of Object.entries(row)) {
    if (key === '_id' || key === '_creationTime' || key === implied) continue
    if (omit.has(key)) continue
    if (file && value === file) {
      out[key.replace(/Id$/, 'Url')] = await ctx.storage.getUrl(file)
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
