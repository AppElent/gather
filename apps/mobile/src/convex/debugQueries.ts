/**
 * Development aid: `EXPO_PUBLIC_DEBUG_QUERIES=1` logs every query subscription
 * the client opens or closes on the socket, as `[convex-query] + users:me` and
 * `[convex-query] - users:me`. Off by default, and never in a release build.
 *
 * It reads the wire rather than the hooks, because the wire is what retention
 * changes: identical watchers share one subscription and the query module
 * (`QueryCacheProvider.tsx`) holds its own watcher open after a screen leaves, so a
 * per-watcher log would show a `-` for every tab change whether anything
 * reached the server or not. Here a tab round trip that answers from retention
 * logs nothing. A reconnect re-adds every live query, so expect a burst of `+`
 * after one.
 *
 * Free of React Native, so the Node suite can drive it.
 */

interface QuerySetMessage {
  type: 'ModifyQuerySet'
  modifications: (
    | { type: 'Add'; queryId: number; udfPath: string }
    | { type: 'Remove'; queryId: number }
  )[]
}

/** The log lines one outgoing client message produces, updating `names`
 * (query id → function) as it goes. Anything else on the socket is ignored. */
export function describeQuerySet(
  data: unknown,
  names: Map<number, string>,
): string[] {
  if (typeof data !== 'string' || !data.includes('"ModifyQuerySet"')) return []
  let message: QuerySetMessage
  try {
    message = JSON.parse(data)
  } catch {
    return []
  }
  if (message.type !== 'ModifyQuerySet') return []
  const lines: string[] = []
  for (const change of message.modifications) {
    if (change.type === 'Add') {
      names.set(change.queryId, change.udfPath)
      lines.push(`[convex-query] + ${change.udfPath}`)
    } else {
      const name = names.get(change.queryId) ?? `#${change.queryId}`
      names.delete(change.queryId)
      lines.push(`[convex-query] - ${name}`)
    }
  }
  return lines
}

/** A WebSocket that logs the query set it sends. */
export function loggingWebSocket(
  Base: typeof WebSocket,
  log: (line: string) => void = console.log,
): typeof WebSocket {
  return class extends Base {
    // Per socket: a reconnect starts a fresh query set with fresh ids.
    private names = new Map<number, string>()
    send(data: Parameters<WebSocket['send']>[0]) {
      for (const line of describeQuerySet(data, this.names)) log(line)
      super.send(data)
    }
  }
}

/** The client's `webSocketConstructor`: the logging one only when asked for,
 * in development. */
export function debugWebSocketConstructor(
  enabled: boolean,
): typeof WebSocket | undefined {
  return enabled ? loggingWebSocket(WebSocket) : undefined
}
