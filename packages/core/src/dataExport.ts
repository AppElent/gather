/**
 * The file "Export your data" hands a person: what it is called, what shape it
 * has, and how a client assembles it from the server's pages.
 *
 * The server decides *what* is in it (`convex/lib/dataExport.ts`, a registry
 * keyed by every table in the schema). This module decides how the pieces are
 * put together, once, so the web download and the phone's share sheet produce
 * the same file. It takes the two server calls as functions rather than
 * importing a Convex client, which is what keeps it dependency-free
 * (ADR-0016) and runnable from a test with no backend.
 *
 * ## Versioning
 *
 * `format` and `version` are the first two keys of the file. Bump `version`
 * when a reader of the previous version would misread the new one: a renamed
 * or removed key, or a changed convention. A table appearing is not a bump —
 * readers are expected to ignore tables they do not know.
 */

export const EXPORT_FORMAT = 'gather.data-export'
export const EXPORT_VERSION = 1

/**
 * Why a table is not in the export, as a key rather than a sentence: the file
 * is data, and the reason is a fact about the table, not prose for a screen.
 */
export type ExportExclusion =
  /** Shipped reference data owned by nobody (ADR-0004, ADR-0024). */
  | 'reference-data'
  /** Internal bookkeeping with no content of its own. */
  | 'bookkeeping'

/**
 * How the file writes things that are not plain content. Stated in the file
 * itself, so somebody opening it without this source can read it.
 */
export const EXPORT_CONVENTIONS = {
  /** Every row carries `id`, its document id; references point at these. */
  ids: 'document-id',
  /** `addedAt` is when the row was created, ISO 8601 UTC. */
  addedAt: 'iso-8601',
  /** A person is written as their display name; somebody no longer in the Group is `null`. */
  people: 'display-name',
  /** A Group you are in is written as its slug; any other Group is left out. */
  groups: 'slug',
  /**
   * A stored photo is a link, not the bytes: the `…Id` column becomes `…Url`.
   * The link needs no sign-in and does not expire, so it opens for anyone who
   * has the file.
   */
  photos: 'url',
  /** Money is whole cents, as stored. */
  money: 'cents',
} as const

/**
 * What is deliberately not in the file, beyond whole tables. Keys, for the same
 * reason as `ExportExclusion`.
 */
export const EXPORT_NOT_INCLUDED = [
  /** Other Members' diary, combos, AI usage and per-Group preferences. */
  'other-members-personal-records',
  /** Other Members' email addresses and account ids; their display name only. */
  'other-members-identifiers',
  /** Notion/Todoist access tokens and Group invite codes. */
  'secrets',
  /** The photo files themselves; see `conventions.photos`. */
  'photo-bytes',
  /** Recipes Shared into your Group live in, and are exported with, their home Group. */
  'recipes-shared-in-from-other-groups',
  /** Tasks in a connected Notion or Todoist list live in that service. */
  'external-task-provider-content',
] as const

/** One Group the person is a Member of, as the manifest names it. */
export interface ExportGroupRef {
  slug: string
  name: string
}

/** What the server says is in the export, before any page is read. */
export interface ExportManifest {
  version: number
  /** Tables read once for the person, in file order. */
  account: string[]
  /** Tables read once per Group, in file order. */
  group: string[]
  excluded: { table: string; reason: ExportExclusion }[]
  /** Columns left out of tables that are otherwise included. */
  omittedFields: Record<string, string[]>
  groups: ExportGroupRef[]
}

export type ExportRow = Record<string, unknown>

export interface ExportPageRequest {
  table: string
  /** Absent for an account table; the Group's slug for a Group table. */
  groupSlug?: string
  cursor: string | null
}

export interface ExportPage {
  rows: ExportRow[]
  cursor: string | null
  isDone: boolean
}

export interface ExportSource {
  manifest: () => Promise<ExportManifest | null>
  page: (request: ExportPageRequest) => Promise<ExportPage>
}

export interface GatherExport {
  format: typeof EXPORT_FORMAT
  version: number
  exportedAt: string
  conventions: typeof EXPORT_CONVENTIONS
  notIncluded: typeof EXPORT_NOT_INCLUDED
  excludedTables: ExportManifest['excluded']
  omittedFields: ExportManifest['omittedFields']
  account: Record<string, ExportRow[]>
  groups: (ExportGroupRef & { tables: Record<string, ExportRow[]> })[]
}

/** How far through an export is, for a progress line. */
export interface ExportProgress {
  /** Tables finished so far, across the account and every Group. */
  done: number
  total: number
}

async function drain(
  source: ExportSource,
  table: string,
  groupSlug: string | undefined,
): Promise<ExportRow[]> {
  const rows: ExportRow[] = []
  let cursor: string | null = null
  for (;;) {
    const page: ExportPage = await source.page({ table, groupSlug, cursor })
    rows.push(...page.rows)
    if (page.isDone) return rows
    cursor = page.cursor
  }
}

/**
 * Read every page the manifest names and assemble the file.
 *
 * Sequential on purpose: each page is a bounded server read, and firing them
 * all at once would trade a slow export for a burst that competes with the app
 * the person is still using. Returns null when nobody is signed in.
 */
export async function collectExport(
  source: ExportSource,
  options: { now?: Date; onProgress?: (progress: ExportProgress) => void } = {},
): Promise<GatherExport | null> {
  const manifest = await source.manifest()
  if (!manifest) return null

  const total =
    manifest.account.length + manifest.groups.length * manifest.group.length
  let done = 0
  const tick = () => options.onProgress?.({ done: ++done, total })

  const account: Record<string, ExportRow[]> = {}
  for (const table of manifest.account) {
    account[table] = await drain(source, table, undefined)
    tick()
  }

  const groups: GatherExport['groups'] = []
  for (const group of manifest.groups) {
    const tables: Record<string, ExportRow[]> = {}
    for (const table of manifest.group) {
      tables[table] = await drain(source, table, group.slug)
      tick()
    }
    groups.push({ ...group, tables })
  }

  return {
    format: EXPORT_FORMAT,
    version: manifest.version,
    exportedAt: (options.now ?? new Date()).toISOString(),
    conventions: EXPORT_CONVENTIONS,
    notIncluded: EXPORT_NOT_INCLUDED,
    excludedTables: manifest.excluded,
    omittedFields: manifest.omittedFields,
    account,
    groups,
  }
}

/** The file's text: indented, because a person is meant to be able to read it. */
export function serializeExport(data: GatherExport): string {
  return `${JSON.stringify(data, null, 2)}\n`
}

/** `gather-export-2026-10-18.json`, in the person's local date. */
export function exportFileName(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  return `gather-export-${day}.json`
}
