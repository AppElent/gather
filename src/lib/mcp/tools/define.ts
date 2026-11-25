import { en as coreEn } from '@gather/core/messages'
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js'
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from 'convex/server'
import { ConvexError, type Value } from 'convex/values'
import type { z } from 'zod'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { GROUP_REFUSAL_MESSAGES } from '../../../../convex/lib/groupAccess'
import { reportError } from '../../observability/report'
import { MCP_SCOPES, type McpAccess } from '../auth'
import { type ViewName, viewUri } from '../views/types'

/** The Convex calls tools make, as the signed-in user. ConvexHttpClient fits. */
export type GatherBackend = {
  query<Query extends FunctionReference<'query'>>(
    query: Query,
    args: FunctionArgs<Query>,
  ): Promise<FunctionReturnType<Query>>
  mutation<Mutation extends FunctionReference<'mutation'>>(
    mutation: Mutation,
    args: FunctionArgs<Mutation>,
  ): Promise<FunctionReturnType<Mutation>>
}

export type ToolContext = {
  backend: GatherBackend
  access: McpAccess
  /** This endpoint's URL as the client sees it (the OAuth resource). */
  endpointUrl: string
  /** Fetches the OAuth userinfo document for the caller's token. */
  userInfo: () => Promise<Record<string, unknown> | undefined>
  now: () => Date
}

type Shape = Record<string, z.ZodType>

type ToolDefinition<Input extends Shape> = {
  name: string
  title: string
  description: string
  input: Input
  /** Read tools need gather:read; write tools need gather:write. */
  access: 'read' | 'write'
  annotations?: Omit<ToolAnnotations, 'title' | 'readOnlyHint'>
  /** Hosts with MCP Apps render this view with the result. */
  view?: ViewName
  run: (
    args: z.infer<z.ZodObject<Input>>,
    context: ToolContext,
  ) => Promise<unknown>
}

export type AnyToolDefinition = ToolDefinition<Shape>

export function defineTool<Input extends Shape>(
  definition: ToolDefinition<Input>,
): AnyToolDefinition {
  return definition as unknown as AnyToolDefinition
}

/**
 * Registers only the tools the token's scopes allow. A write grant implies
 * read: a client that asked for `gather:write` alone still sees the read
 * tools, because Convex lets the same token read.
 */
export function registerTools(
  server: McpServer,
  tools: readonly AnyToolDefinition[],
  context: ToolContext,
) {
  const canWrite = context.access.scopes.has(MCP_SCOPES.write)
  const canRead = canWrite || context.access.scopes.has(MCP_SCOPES.read)
  for (const tool of tools) {
    if (!(tool.access === 'read' ? canRead : canWrite)) continue
    const config = {
      title: tool.title,
      description: tool.description,
      inputSchema: tool.input,
      annotations: {
        title: tool.title,
        readOnlyHint: tool.access === 'read',
        openWorldHint: false,
        ...(tool.access === 'write'
          ? { destructiveHint: false, idempotentHint: false }
          : {}),
        ...tool.annotations,
      },
    }
    const callback = async (args: unknown) => {
      try {
        return toolResult(await tool.run(args as never, context))
      } catch (error) {
        return toolError(error)
      }
    }
    if (tool.view)
      registerAppTool(
        server,
        tool.name,
        { ...config, _meta: { ui: { resourceUri: viewUri(tool.view) } } },
        callback,
      )
    else server.registerTool(tool.name, config, callback)
  }
}

/** Errors a tool raises on purpose; their message is safe to show. */
export class ToolInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ToolInputError'
  }
}

export function toolResult(value: unknown) {
  const structured =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : { result: value }
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(structured) }],
    structuredContent: structured,
  }
}

/**
 * One answer for a Group the caller cannot use, whether it does not exist or
 * they are not in it. Group ids are not guessable slugs, so unlike the web's
 * address bar (ADR-0009) there is no typo to be kind about.
 */
export const GROUP_NOT_FOUND =
  'Group not found. Call list_groups for the Groups you can use.'

/**
 * A refused Group, keyed (`groups:*`, APP-429) or as the sentence a Convex
 * deployment from before the keys threw; the agent hears GROUP_NOT_FOUND.
 */
const GROUP_REFUSALS = new Set<string>([
  GROUP_REFUSAL_MESSAGES['unknown-slug'],
  GROUP_REFUSAL_MESSAGES['unknown-group'],
  GROUP_REFUSAL_MESSAGES['not-a-member'],
])
const GROUP_REFUSAL_KINDS = new Set<string>([
  'groups:unknown-slug',
  'groups:unknown-group',
  'groups:not-a-member',
])

/**
 * Keyed refusals (`{ kind }`) as English sentences. "Missing" and "in another
 * Group" read the same (ADR-0009), including the calendar's `deleted`.
 */
const REFUSAL_KINDS: Record<string, string> = {
  'calendar:not-found': 'Calendar or event not found.',
  'calendar:deleted': 'Calendar or event not found.',
  'calendar:conflict':
    'The event changed while you were editing it. Read it again and retry.',
  'calendar:assignee-not-member': 'That person is not in this Group.',
  'calendar:person-not-member': 'That person is not in this Group.',
  'notes:too-long': coreEn.notes.refusals['notes:too-long'],
}

/** What the agent reads about a refusal Gather made on purpose. */
function refusalText(error: ConvexError<Value>): string {
  const data = error.data
  if (typeof data === 'string') {
    return GROUP_REFUSALS.has(data) ? GROUP_NOT_FOUND : data
  }
  const kind =
    data && typeof data === 'object' && 'kind' in data ? data.kind : undefined
  if (typeof kind !== 'string') return 'Gather refused this.'
  if (GROUP_REFUSAL_KINDS.has(kind)) return GROUP_NOT_FOUND
  if (kind === 'groups:not-signed-in')
    return GROUP_REFUSAL_MESSAGES['not-signed-in']
  return REFUSAL_KINDS[kind] ?? `Gather refused this (${kind}).`
}

/**
 * A failed tool as the agent sees it. A ToolInputError or a ConvexError is
 * Gather refusing on purpose and its text is safe; a rejected argument (an id
 * of the wrong kind, say) is the caller's mistake. Anything else is a fault:
 * it goes to Sentry and the agent hears only that the tool failed.
 */
export function toolError(error: unknown) {
  if (error instanceof ToolInputError) return errorResult(error.message)
  if (error instanceof ConvexError) return errorResult(refusalText(error))
  if (error instanceof Error && /ArgumentValidationError/.test(error.message))
    return errorResult(
      'An id or value was not valid. Use ids returned by the list tools.',
    )
  reportError(error)
  return errorResult('The Gather tool failed.')
}

function errorResult(message: string) {
  return {
    isError: true,
    content: [{ type: 'text' as const, text: message }],
  }
}

/**
 * Fields that never leave through MCP: Convex bookkeeping, internal user ids
 * (people are named, not numbered), storage ids, and the ids of Groups the
 * caller may not be in.
 */
const PRIVATE_FIELDS = new Set([
  '_creationTime',
  'createdBy',
  'createdByUserId',
  'updatedBy',
  'assigneeIds',
  'assigneeId',
  'assignmentNotice',
  'imageId',
  'sharedGroupIds',
  'providerConfig',
])

/** Public shape for a Convex document: `_id` becomes `id`; private fields go. */
export function publicDoc(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(publicDoc)
  if (!value || typeof value !== 'object') return value
  const out: Record<string, unknown> = {}
  for (const [key, field] of Object.entries(value)) {
    if (PRIVATE_FIELDS.has(key)) continue
    out[key === '_id' ? 'id' : key] = publicDoc(field)
  }
  return out
}

export function isoDate(ms: number | undefined): string | undefined {
  return typeof ms === 'number' ? new Date(ms).toISOString() : undefined
}

/**
 * The slug Convex addresses a Group by, for a Group id from list_groups.
 * Checks membership here (one list per request) and Convex checks it again;
 * a Group the caller is not in reads the same as one that does not exist.
 */
export async function groupSlug(
  context: ToolContext,
  groupId: string,
): Promise<string> {
  const groups = await myGroups(context)
  const group = groups.find((g) => g._id === groupId)
  if (!group) throw new ToolInputError(GROUP_NOT_FOUND)
  return group.slug
}

const groupsByContext = new WeakMap<
  ToolContext,
  Promise<FunctionReturnType<typeof api.groups.myGroups>>
>()

export function myGroups(context: ToolContext) {
  let groups = groupsByContext.get(context)
  if (!groups) {
    groups = context.backend.query(api.groups.myGroups, {})
    groupsByContext.set(context, groups)
    // A failed lookup is not remembered.
    groups.catch(() => groupsByContext.delete(context))
  }
  return groups
}

/** A Convex id from a tool argument; Convex validates its table. */
export function asId<
  T extends
    | 'recipes'
    | 'mealEntries'
    | 'tasks'
    | 'taskLists'
    | 'notes'
    | 'calendars'
    | 'calendarEvents',
>(
  value: string,
): Id<T> {
  return value as Id<T>
}
