import { type AddressInfo, createServer } from 'node:net'
import { WebSocketServer } from 'ws'

/**
 * A Home Assistant that exists only in a test (APP-495): the auth handshake
 * and the three read commands. Any other command is recorded and refused, so
 * a test can assert the connector never sent one.
 */
export interface FakeStatistic {
  statistic_id: string
  name?: string | null
  has_sum?: boolean
  has_mean?: boolean
  statistics_unit_of_measurement?: string
  unit_class?: string | null
}

export interface FakeHomeAssistant {
  /** `ws://127.0.0.1:port/api/websocket`. */
  url: string
  token: string
  version: string
  /** `energy/get_prefs`; null answers `not_found`. */
  prefs: unknown
  statistics: FakeStatistic[]
  /** Running sums per statistic id, per hour start. */
  sums: Record<string, Map<number, number>>
  means: Record<string, Map<number, number>>
  /** Every message received after authenticating. */
  received: { type: string; [key: string]: unknown }[]
  connections: number
  /** Drop the socket when this many period questions were answered. */
  dropAfterPeriods: number | null
  stop(): Promise<void>
}

const HOUR = 3_600_000

/** A counter of `count` hours from `from`, `step` per hour. */
export function counter(
  from: number,
  count: number,
  step: number,
  start = 0,
): Map<number, number> {
  return new Map(
    Array.from({ length: count }, (_, index) => [
      from + index * HOUR,
      start + (index + 1) * step,
    ]),
  )
}

/** A home with a split meter, solar, a battery and gas. */
export function fullHome(): Pick<FakeHomeAssistant, 'prefs' | 'statistics'> {
  const energy = (statistic_id: string, name: string): FakeStatistic => ({
    statistic_id,
    name,
    has_sum: true,
    has_mean: false,
    statistics_unit_of_measurement: 'kWh',
    unit_class: 'energy',
  })
  return {
    prefs: {
      energy_sources: [
        {
          type: 'grid',
          flow_from: [
            { stat_energy_from: 'sensor.p1_import_tariff_1' },
            { stat_energy_from: 'sensor.p1_import_tariff_2' },
          ],
          flow_to: [
            { stat_energy_to: 'sensor.p1_export_tariff_1' },
            { stat_energy_to: 'sensor.p1_export_tariff_2' },
          ],
        },
        { type: 'solar', stat_energy_from: 'sensor.solar_total' },
        {
          type: 'battery',
          stat_energy_from: 'sensor.battery_out',
          stat_energy_to: 'sensor.battery_in',
        },
        { type: 'gas', stat_energy_from: 'sensor.p1_gas' },
      ],
    },
    statistics: [
      energy('sensor.p1_import_tariff_1', 'P1 import tariff 1'),
      energy('sensor.p1_import_tariff_2', 'P1 import tariff 2'),
      energy('sensor.p1_export_tariff_1', 'P1 export tariff 1'),
      energy('sensor.p1_export_tariff_2', 'P1 export tariff 2'),
      energy('sensor.solar_total', 'Solar'),
      energy('sensor.battery_in', 'Battery charged'),
      energy('sensor.battery_out', 'Battery discharged'),
      energy('sensor.zonneplan_import', 'Zonneplan import'),
      {
        statistic_id: 'sensor.p1_gas',
        name: 'P1 gas',
        has_sum: true,
        has_mean: false,
        statistics_unit_of_measurement: 'm³',
        unit_class: 'volume',
      },
      {
        statistic_id: 'sensor.outside_temperature',
        has_sum: false,
        has_mean: true,
        statistics_unit_of_measurement: '°C',
      },
    ],
  }
}

export async function startFakeHomeAssistant(
  options: { port?: number; token?: string } = {},
): Promise<FakeHomeAssistant> {
  const server = new WebSocketServer({
    host: '127.0.0.1',
    port: options.port ?? 0,
    path: '/api/websocket',
  })
  await new Promise<void>((resolve) => server.once('listening', resolve))
  let periods = 0
  const fake: FakeHomeAssistant = {
    url: `ws://127.0.0.1:${(server.address() as AddressInfo).port}/api/websocket`,
    token: options.token ?? 'fake-token',
    version: '2026.11.2',
    ...fullHome(),
    sums: {},
    means: {},
    received: [],
    connections: 0,
    dropAfterPeriods: null,
    stop: () =>
      new Promise((resolve) => {
        for (const client of server.clients) client.terminate()
        server.close(() => resolve())
      }),
  }
  server.on('connection', (socket) => {
    fake.connections += 1
    let authenticated = false
    const send = (message: unknown) => socket.send(JSON.stringify(message))
    send({ type: 'auth_required', ha_version: fake.version })
    socket.on('message', (data) => {
      const message = JSON.parse(data.toString())
      if (!authenticated) {
        authenticated =
          message.type === 'auth' && message.access_token === fake.token
        send(
          authenticated
            ? { type: 'auth_ok', ha_version: fake.version }
            : { type: 'auth_invalid', message: 'Invalid access token' },
        )
        if (!authenticated) socket.close()
        return
      }
      fake.received.push(message)
      const { id } = message
      const result = (value: unknown) =>
        send({ id, type: 'result', success: true, result: value })
      const refuse = (code: string) =>
        send({ id, type: 'result', success: false, error: { code, message: code } })
      switch (message.type) {
        case 'energy/get_prefs':
          return fake.prefs === null ? refuse('not_found') : result(fake.prefs)
        case 'recorder/list_statistic_ids':
          return result(fake.statistics)
        case 'recorder/statistics_during_period': {
          if (fake.dropAfterPeriods !== null && periods >= fake.dropAfterPeriods) {
            return socket.terminate()
          }
          periods += 1
          const from = Date.parse(message.start_time)
          const to = Date.parse(message.end_time)
          const rows = (id: string) => {
            const inside = (at: number) => at >= from && at < to
            const hours = [
              ...new Set([
                ...(fake.sums[id]?.keys() ?? []),
                ...(fake.means[id]?.keys() ?? []),
              ]),
            ]
            return hours
              .filter(inside)
              .sort((a, b) => a - b)
              .map((start) => ({
                start,
                end: start + HOUR,
                sum: fake.sums[id]?.get(start) ?? null,
                mean: fake.means[id]?.get(start) ?? null,
              }))
          }
          return result(
            Object.fromEntries(
              (message.statistic_ids as string[])
                .map((each) => [each, rows(each)] as const)
                .filter(([, found]) => found.length > 0),
            ),
          )
        }
        default:
          return refuse('unauthorized')
      }
    })
  })
  return fake
}

/** A port nothing listens on. */
export async function closedPort(): Promise<number> {
  const server = createServer()
  await new Promise<void>((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve()),
  )
  const { port } = server.address() as AddressInfo
  await new Promise<void>((resolve) => server.close(() => resolve()))
  return port
}
