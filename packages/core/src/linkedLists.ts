/**
 * The last answer of each linked list (Todoist, Notion), kept once per app and
 * fetched again only when someone asks (ADR-0021: first open, then manual
 * refresh). A failed fetch keeps the last rows readable and says so through
 * the list's `sync`. A write goes to the provider first and changes these rows
 * only once it was accepted (`writeLinkedTask`, ADR-0020).
 *
 * Shared by the phone and the web (APP-308); the caller sends and fetches.
 */
import { applyLinkedWrite } from './linkedTasks'
import type { Assignable } from './taskLists'
import type { ListSync, Priority, Task } from './taskModel'

export interface ExternalEntry {
  sync: Exclude<ListSync, 'live'>
  tasks: Task[]
  /** Whom its tasks can be given to (APP-405); absent while not known. */
  assignable?: Assignable
  /**
   * Whether the rows are what the provider last answered, so they may be
   * written to: kept while they load again, lost when that fails.
   */
  fresh?: boolean
}

/** One task as a provider answers it. */
export interface ProviderTask {
  externalId: string
  title: string
  done: boolean
  dueDate?: string
  priority?: Priority
  labels?: string[]
  url?: string
  repeatText?: string
  parentExternalId?: string
  assigneeId?: string
  assigneeName?: string
}

/** What `taskLists.getTasks` answers, as much of it as is read here. */
export type FetchResult =
  | { status: 'ok'; tasks: ProviderTask[]; assignable?: Assignable }
  | { status: 'reconnect' }
  | { status: 'error' }
export type FetchTasks = (listId: string) => Promise<FetchResult>

/** A write `taskLists.writeTask` takes. */
export type LinkedTaskWrite =
  | {
      kind: 'create'
      title: string
      parentId?: string
      dueDate?: string
      priority?: Priority
      labels?: string[]
      requestKey?: string
    }
  | {
      kind: 'update'
      taskId: string
      title?: string
      dueDate?: string | null
      priority?: Priority | null
      labels?: string[]
      assigneeId?: string | null
    }
  | {
      kind: 'setDone'
      taskId: string
      done: boolean
      withSubtasks?: boolean
      requestKey?: string
    }
  | { kind: 'move'; taskId: string; parentId: string | null }

type WriteResult =
  | { status: 'ok'; tasks: ProviderTask[]; refresh: boolean }
  | { status: 'reconnect' }
  | { status: 'error'; reason: 'not-found' | 'not-assignable' | 'failed' }
export type SendWrite = (
  listId: string,
  write: LinkedTaskWrite,
) => Promise<WriteResult>

export type LinkedWriteFailure =
  /** The connection may not write (any more): nothing was changed. */
  | 'reconnect'
  /** The task is not in the provider's list (any more). */
  | 'not-found'
  /** That Member is not in the provider's project (any more). */
  | 'not-assignable'
  /** The rows on screen are not the provider's; they have to load first. */
  | 'stale'
  /** There is no connection, so nothing was sent. */
  | 'offline'
  /** The provider or the network did not answer, or refused. */
  | 'failed'

/** A write to a linked list that its provider did not take. */
export class LinkedWriteError extends Error {
  constructor(
    readonly reason: LinkedWriteFailure,
    readonly listId: string,
  ) {
    super(`A linked list's write was not taken: ${reason}`)
    this.name = 'LinkedWriteError'
  }
}

let external: ReadonlyMap<string, ExternalEntry> = new Map()
const inFlight = new Map<string, Promise<ListSync>>()
const listeners = new Set<() => void>()
/** Each linked list's fetches and writes run one after another. */
const queues = new Map<string, Promise<unknown>>()
/**
 * How many writes are on their way to each task, per list: kept beside the
 * rows, because a refresh replaces those.
 */
const onTheirWay = new Map<string, Map<string, number>>()

/**
 * Lists with a write that outlasted its wait. It may still land, so their rows
 * are not the provider's until it is answered.
 */
const unanswered = new Map<string, number>()

/** Lists a write was refused on offline, to be read once back online. */
const awaitingConnection = new Set<string>()

/** The key of each "Complete all" until it was taken, by list and task. */
const completeKeys = new Map<string, string>()

/** A "Complete all"'s key: the same one again until the provider took it. */
export function completeKey(
  listId: string,
  taskId: string,
  newKey: () => string,
): string {
  const place = `${listId}:${taskId}`
  const key = completeKeys.get(place) ?? newKey()
  completeKeys.set(place, key)
  return key
}

/** The connection as a write needs it. */
export interface Connection {
  isOnline: () => boolean
  /** Runs once, the next time the connection is back. */
  whenOnline: (run: () => void) => void
}

const ALWAYS_ONLINE: Connection = {
  isOnline: () => true,
  whenOnline: () => {},
}

interface ConnectionState {
  isWebSocketConnected: boolean
}

/** A Convex client's connection. */
export function connectionOf(convex: {
  connectionState: () => ConnectionState
  subscribeToConnectionState: (
    listen: (state: ConnectionState) => void,
  ) => () => void
}): Connection {
  return {
    isOnline: () => convex.connectionState().isWebSocketConnected,
    whenOnline: (run) => {
      // May be told at once, before `stop` is known.
      let stop: (() => void) | undefined
      let done = false
      stop = convex.subscribeToConnectionState((state) => {
        if (done || !state.isWebSocketConnected) return
        done = true
        stop?.()
        run()
      })
      if (done) stop()
    },
  }
}

/**
 * How long a write or fetch may take, waiting its turn included. Convex holds
 * an action that lost its connection until it is back, and an answer by then
 * is no use: the list would wait for it, and a write would land unasked.
 */
export const PROVIDER_WAIT_MS = 30_000

function within<T>(promise: Promise<T>, ms = PROVIDER_WAIT_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('No answer in time')), ms)
    promise.then(resolve, reject).finally(() => clearTimeout(timer))
  })
}

function enqueue<T>(listId: string, job: () => Promise<T>): Promise<T> {
  const run = (queues.get(listId) ?? Promise.resolve()).then(job)
  queues.set(
    listId,
    run.catch(() => {}),
  )
  return run
}

function put(listId: string, entry: ExternalEntry) {
  const busy = onTheirWay.get(listId)
  const tasks = entry.tasks.map((task) => {
    if (Boolean(task.pending) === Boolean(busy?.has(task.id))) return task
    const { pending: _, ...rest } = task
    return busy?.has(task.id) ? { ...rest, pending: true as const } : rest
  })
  external = new Map(external).set(listId, { ...entry, tasks })
  for (const listener of listeners) listener()
}

export function subscribeExternal(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Every linked list's last answer, as one immutable value per change. */
export function externalSnapshot(): ReadonlyMap<string, ExternalEntry> {
  return external
}

/** A provider's answer as rows, or the previous rows marked stale. */
export function externalEntry(
  listId: string,
  result: FetchResult,
  previous: readonly Task[],
): ExternalEntry {
  if (result.status !== 'ok') {
    return {
      sync: result.status === 'reconnect' ? 'reconnect' : 'failed',
      tasks: [...previous],
    }
  }
  return {
    sync: 'synced',
    fresh: true,
    ...(result.assignable ? { assignable: result.assignable } : {}),
    tasks: result.tasks.map((task, order) => linkedTask(listId, task, order)),
  }
}

function linkedTask(listId: string, task: ProviderTask, order: number): Task {
  return {
    id: task.externalId,
    listId,
    linked: true,
    title: task.title,
    done: task.done,
    dueDate: task.dueDate,
    priority: task.priority,
    labels: task.labels ?? [],
    repeatText: task.repeatText,
    // Left out of the phone's rows before: only the web links out to it.
    ...(task.url ? { sourceUrl: task.url } : {}),
    order,
    ...(task.assigneeId ? { assigneeId: task.assigneeId } : {}),
    ...(task.assigneeName === undefined
      ? {}
      : { assigneeName: task.assigneeName }),
    // Todoist's and Notion's subtasks (APP-304).
    ...(task.parentExternalId ? { parentTaskId: task.parentExternalId } : {}),
  }
}

/** The held rows after the provider took `write` and answered `answered`. */
export function afterLinkedWrite(
  listId: string,
  tasks: readonly Task[],
  write: LinkedTaskWrite,
  answered: readonly ProviderTask[],
): Task[] {
  const orders = new Map(tasks.map((task) => [task.id, task.order]))
  let next = tasks.reduce((most, task) => Math.max(most, task.order + 1), 0)
  const row = (task: Task) => ({
    externalId: task.id,
    done: task.done,
    parentExternalId: task.parentTaskId,
    task,
  })
  return applyLinkedWrite(
    tasks.map(row),
    write,
    answered.map((task) =>
      row(linkedTask(listId, task, orders.get(task.externalId) ?? next++)),
    ),
  ).map(({ task, done }) => (task.done === done ? task : { ...task, done }))
}

/** Marks or unmarks one row as having a write on its way. */
function markPending(listId: string, taskId: string | undefined, on: boolean) {
  if (!taskId) return
  const busy = onTheirWay.get(listId) ?? new Map<string, number>()
  const count = (busy.get(taskId) ?? 0) + (on ? 1 : -1)
  if (count > 0) busy.set(taskId, count)
  else busy.delete(taskId)
  onTheirWay.set(listId, busy)
  const entry = external.get(listId)
  if (entry) put(listId, entry)
}

/**
 * A write to a linked list, made in its provider first (ADR-0020). Nothing
 * changes here until the provider took it; a refusal leaves the rows as they
 * are and rejects. After an unclear failure the list is fetched again, so it
 * shows what the provider has, or goes stale and read-only if that fails too.
 */
export async function writeLinkedTask(
  listId: string,
  write: LinkedTaskWrite,
  send: SendWrite,
  fetchTasks: FetchTasks,
  connection: Connection = ALWAYS_ONLINE,
): Promise<{ taskId?: string }> {
  const taskId = 'taskId' in write ? write.taskId : undefined
  // Convex would keep an unsent action and send it once back online.
  const refuseOffline = () => {
    if (connection.isOnline()) return
    const entry = external.get(listId)
    if (entry) put(listId, { sync: 'failed', tasks: entry.tasks })
    syncWhenOnline(listId, fetchTasks, connection)
    throw new LinkedWriteError('offline', listId)
  }
  if (!external.get(listId)?.fresh) throw new LinkedWriteError('stale', listId)
  refuseOffline()
  const asked = Date.now()
  markPending(listId, taskId, true)
  let refresh = false
  try {
    return await enqueue(listId, async () => {
      if (!external.get(listId)?.fresh) {
        throw new LinkedWriteError('stale', listId)
      }
      refuseOffline()
      // Waited behind something that hung: too late to act on unasked.
      if (Date.now() - asked >= PROVIDER_WAIT_MS) {
        throw new LinkedWriteError('stale', listId)
      }
      let result: WriteResult
      const sent = send(listId, write)
      let settled = false
      const settle = () => {
        settled = true
      }
      sent.then(settle, settle)
      sent.then(
        (answer) => {
          // Also when the answer came too late for the write to wait for it.
          if (answer.status === 'ok' && write.kind === 'setDone') {
            completeKeys.delete(`${listId}:${write.taskId}`)
          }
        },
        () => {},
      )
      try {
        result = await within(sent)
      } catch {
        refresh = settled
        if (!settled) {
          const entry = external.get(listId)
          if (entry) put(listId, { sync: 'failed', tasks: entry.tasks })
          unanswered.set(listId, (unanswered.get(listId) ?? 0) + 1)
          const answered = async () => {
            const left = (unanswered.get(listId) ?? 1) - 1
            if (left > 0) unanswered.set(listId, left)
            else unanswered.delete(listId)
            // A fetch begun before this one's answer may not hold it.
            await inFlight.get(listId)
            void syncExternalList(listId, fetchTasks)
          }
          void sent.then(answered, answered)
        }
        throw new LinkedWriteError('failed', listId)
      }
      const entry = external.get(listId) ?? { sync: 'synced', tasks: [] }
      if (result.status === 'reconnect') {
        put(listId, { sync: 'reconnect', tasks: entry.tasks })
        throw new LinkedWriteError('reconnect', listId)
      }
      if (result.status === 'error') {
        refresh = true
        throw new LinkedWriteError(result.reason, listId)
      }
      refresh = result.refresh
      put(listId, {
        ...entry,
        tasks: afterLinkedWrite(listId, entry.tasks, write, result.tasks),
      })
      return { taskId: result.tasks[0]?.externalId }
    })
  } finally {
    markPending(listId, taskId, false)
    if (refresh) void syncExternalList(listId, fetchTasks)
  }
}

/**
 * Reads a list again once the connection is back, so that an offline refusal
 * does not leave it read-only (APP-799). One read per refusal, not a sync.
 */
function syncWhenOnline(
  listId: string,
  fetchTasks: FetchTasks,
  connection: Connection,
) {
  if (awaitingConnection.has(listId)) return
  awaitingConnection.add(listId)
  connection.whenOnline(async () => {
    awaitingConnection.delete(listId)
    if (external.get(listId)?.fresh) return
    const sync = await syncExternalList(listId, fetchTasks)
    // It dropped again before the answer.
    if (sync === 'failed' && !connection.isOnline()) {
      syncWhenOnline(listId, fetchTasks, connection)
    }
  })
}

/** Asks the provider for one list now; a second ask while one runs joins it. */
export function syncExternalList(
  listId: string,
  fetchTasks: FetchTasks,
): Promise<ListSync> {
  const running = inFlight.get(listId)
  if (running) return running
  put(listId, {
    tasks: [],
    ...external.get(listId),
    sync: 'loading',
  })
  // A write on its way finishes first, so the answer already holds it.
  const run = enqueue(listId, async () => {
    const result = await within(fetchTasks(listId)).catch(() => null)
    const previous = external.get(listId)?.tasks ?? []
    const entry: ExternalEntry = result
      ? externalEntry(listId, result, previous)
      : { sync: 'failed', tasks: previous }
    // An unanswered write may still change what was just read.
    put(listId, unanswered.has(listId) ? { ...entry, fresh: false } : entry)
    return entry.sync
  }).finally(() => inFlight.delete(listId))
  inFlight.set(listId, run)
  return run
}

/**
 * Fetches the linked lists nobody has an answer for yet. A list that failed
 * is asked again on the next open, since reconnecting happens elsewhere.
 */
export function ensureExternalLists(
  listIds: readonly string[],
  fetchTasks: FetchTasks,
) {
  for (const listId of listIds) {
    const sync = external.get(listId)?.sync
    if (sync !== 'loading' && sync !== 'synced') {
      void syncExternalList(listId, fetchTasks)
    }
  }
}
