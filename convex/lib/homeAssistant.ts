'use node'

/**
 * A read-only Home Assistant WebSocket client (APP-495).
 *
 * It can send three commands and no others: the Energy dashboard's
 * preferences, the list of statistics, and hourly statistics. There is no
 * general "send", so nothing built on it can call a service.
 *
 * The token is written to the socket once, in the auth message, and is in no
 * error, log line or return value. Errors carry only a code.
 */
import type { EnergySourceProblem } from '@gather/core/energy'
import WebSocket from 'ws'
import { homeAssistantSocket } from './homeAssistantAddress'

const CONNECT_TIMEOUT_MS = 15_000
const ANSWER_TIMEOUT_MS = 60_000
/** A month of every channel is well under a megabyte. */
const MAX_MESSAGE_BYTES = 32 * 1024 * 1024

type ReadCommand =
  | { type: 'energy/get_prefs' }
  | { type: 'recorder/list_statistic_ids' }
  | {
      type: 'recorder/statistics_during_period'
      start_time: string
      end_time: string
      statistic_ids: string[]
      period: 'hour'
      units: { energy: 'kWh'; volume: 'm³' }
      types: ('sum' | 'mean')[]
    }

export class HomeAssistantError extends Error {
  constructor(
    readonly problem: Extract<
      EnergySourceProblem,
      'unreachable' | 'notHomeAssistant' | 'badToken' | 'syncFailed'
    >,
  ) {
    super(problem)
  }
}

export interface HomeAssistantClient {
  version: string
  /** Null when no Energy dashboard is set up. */
  energyPreferences(): Promise<unknown>
  statistics(): Promise<unknown>
  hourly(
    statisticIds: string[],
    from: number,
    to: number,
  ): Promise<Record<string, unknown>>
  close(): void
}

/** Connects and authenticates. Throws `HomeAssistantError` and nothing else. */
export async function connectHomeAssistant(
  origin: string,
  token: string,
): Promise<HomeAssistantClient> {
  let socket: WebSocket
  try {
    const target = homeAssistantSocket(origin)
    socket = new WebSocket(target.url, {
      ...target.options,
      followRedirects: false,
      handshakeTimeout: CONNECT_TIMEOUT_MS,
      maxPayload: MAX_MESSAGE_BYTES,
      perMessageDeflate: false,
    })
  } catch {
    throw new HomeAssistantError('unreachable')
  }

  type Waiting = {
    resolve: (value: unknown) => void
    reject: (error: Error) => void
    timer: ReturnType<typeof setTimeout>
  }
  const waiting = new Map<number, Waiting>()
  let failed: HomeAssistantError | null = null
  let onAuth: ((message: Record<string, unknown>) => void) | null = null
  let onFail: ((error: HomeAssistantError) => void) | null = null

  const fail = (problem: HomeAssistantError['problem']) => {
    if (failed) return
    failed = new HomeAssistantError(problem)
    onFail?.(failed)
    for (const each of waiting.values()) {
      clearTimeout(each.timer)
      each.reject(failed)
    }
    waiting.clear()
    socket.terminate()
  }
  socket.on('error', () => fail('unreachable'))
  socket.on('close', () => fail('unreachable'))
  // Something answered over HTTP but did not upgrade: a page, a proxy error.
  socket.on('unexpected-response', (_request, response) => {
    response.destroy()
    fail((response.statusCode ?? 500) >= 500 ? 'unreachable' : 'notHomeAssistant')
  })
  socket.on('message', (data) => {
    let message: unknown
    try {
      message = JSON.parse(data.toString())
    } catch {
      return fail('notHomeAssistant')
    }
    if (typeof message !== 'object' || message === null) {
      return fail('notHomeAssistant')
    }
    const row = message as Record<string, unknown>
    if (onAuth) return onAuth(row)
    if (row.type !== 'result' || typeof row.id !== 'number') return
    const each = waiting.get(row.id)
    if (!each) return
    waiting.delete(row.id)
    clearTimeout(each.timer)
    if (row.success === true) return each.resolve(row.result)
    const code = (row.error as { code?: unknown } | undefined)?.code
    each.reject(new CommandError(typeof code === 'string' ? code : ''))
  })

  const version = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => fail('unreachable'), CONNECT_TIMEOUT_MS)
    const settle = () => {
      clearTimeout(timer)
      onAuth = null
      onFail = null
    }
    onFail = (error) => {
      settle()
      reject(error)
    }
    onAuth = (message) => {
      if (message.type === 'auth_required') {
        socket.send(JSON.stringify({ type: 'auth', access_token: token }))
      } else if (message.type === 'auth_ok') {
        settle()
        resolve(
          typeof message.ha_version === 'string'
            ? message.ha_version.slice(0, 40)
            : '',
        )
      } else if (message.type === 'auth_invalid') {
        fail('badToken')
      } else {
        fail('notHomeAssistant')
      }
    }
  })

  let lastId = 0
  function ask(command: ReadCommand): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (failed) return reject(failed)
      lastId += 1
      const id = lastId
      const timer = setTimeout(() => fail('unreachable'), ANSWER_TIMEOUT_MS)
      waiting.set(id, { resolve, reject, timer })
      socket.send(JSON.stringify({ ...command, id }))
    })
  }
  /** A command Home Assistant refuses is not one of ours going wrong. */
  async function read(command: ReadCommand): Promise<unknown> {
    try {
      return await ask(command)
    } catch (error) {
      if (error instanceof HomeAssistantError) throw error
      throw new HomeAssistantError('syncFailed')
    }
  }

  return {
    version,
    async energyPreferences() {
      try {
        return await ask({ type: 'energy/get_prefs' })
      } catch (error) {
        // No Energy dashboard: `not_found`, or the command does not exist.
        if (
          error instanceof CommandError &&
          (error.code === 'not_found' || error.code === 'unknown_command')
        ) {
          return null
        }
        if (error instanceof HomeAssistantError) throw error
        throw new HomeAssistantError('syncFailed')
      }
    },
    statistics: () => read({ type: 'recorder/list_statistic_ids' }),
    async hourly(statisticIds, from, to) {
      const result = await read({
        type: 'recorder/statistics_during_period',
        start_time: new Date(from).toISOString(),
        end_time: new Date(to).toISOString(),
        statistic_ids: statisticIds,
        period: 'hour',
        units: { energy: 'kWh', volume: 'm³' },
        types: ['sum', 'mean'],
      })
      return typeof result === 'object' && result !== null
        ? (result as Record<string, unknown>)
        : {}
    },
    close() {
      failed ??= new HomeAssistantError('unreachable')
      socket.close()
      // A peer that never answers the close must not keep the action alive.
      const late = setTimeout(() => socket.terminate(), 2_000)
      socket.once('close', () => clearTimeout(late))
    },
  }
}

class CommandError extends Error {
  constructor(readonly code: string) {
    super('command')
  }
}
