// @vitest-environment node
import { afterEach, describe, expect, test, vi } from 'vitest'
import { homeAssistantSocket, isPublicIp, publicLookup } from './homeAssistantAddress'
import { homeAssistantOrigin } from './homeAssistantUrl'

const resolves = vi.hoisted(() => ({
  to: [] as { address: string; family: number }[],
}))
vi.mock('node:dns', () => ({
  lookup: (
    _host: string,
    _options: unknown,
    callback: (error: null, addresses: typeof resolves.to) => void,
  ) => callback(null, resolves.to),
}))
afterEach(() => {
  resolves.to = []
})

describe('the address an admin types', () => {
  test.each([
    ['https://ha.example.com', 'https://ha.example.com'],
    ['ha.example.com:8443', 'https://ha.example.com:8443'],
    [' https://abc.ui.nabu.casa/lovelace/0?x=1#y ', 'https://abc.ui.nabu.casa'],
  ])('%s is %s', (typed, origin) => {
    expect(homeAssistantOrigin(typed)).toEqual({ origin })
  })
  test.each([
    ['', 'addressInvalid'],
    ['https://', 'addressInvalid'],
    ['https://u:p@ha.example.com', 'addressInvalid'],
    ['http://ha.example.com', 'addressNotHttps'],
    ['ws://ha.example.com', 'addressNotHttps'],
    ['file:///etc/passwd', 'addressNotHttps'],
    ['https://localhost', 'addressPrivate'],
    ['https://homeassistant', 'addressPrivate'],
    ['https://homeassistant.local:8123', 'addressPrivate'],
    ['https://ha.home.arpa', 'addressPrivate'],
    ['https://10.0.0.4', 'addressPrivate'],
    ['https://169.254.169.254', 'addressPrivate'],
    ['https://[::1]', 'addressPrivate'],
    ['https://2130706433', 'addressPrivate'],
  ])('%s is refused as %s', (typed, problem) => {
    expect(homeAssistantOrigin(typed)).toEqual({ problem })
  })
})

describe('what it resolves to', () => {
  test.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.31.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '255.255.255.255',
    '::1',
    '::',
    'fe80::1',
    'fd00::1',
    '::ffff:10.0.0.1',
    '64:ff9b::a00:1',
    '2002:a00:1::',
    'not an address',
  ])('%s is not public', (address) => {
    expect(isPublicIp(address)).toBe(false)
  })
  test.each(['1.1.1.1', '100.128.0.1', '2606:4700::1111'])('%s is public', (address) => {
    expect(isPublicIp(address)).toBe(true)
  })

  const looked = (all: boolean) =>
    new Promise<{ error: Error | null; answer: unknown }>((resolve) =>
      publicLookup('ha.example.com', { all }, (error, answer) =>
        resolve({ error, answer }),
      ),
    )
  test('a name with any private address is refused', async () => {
    resolves.to = [
      { address: '1.1.1.1', family: 4 },
      { address: '10.0.0.1', family: 4 },
    ]
    expect((await looked(true)).error).toBeInstanceOf(Error)
    expect((await looked(false)).error).toBeInstanceOf(Error)
  })
  test('a public name resolves, in the form asked for', async () => {
    resolves.to = [{ address: '1.1.1.1', family: 4 }]
    expect(await looked(true)).toEqual({ error: null, answer: resolves.to })
    expect(await looked(false)).toEqual({ error: null, answer: '1.1.1.1' })
  })
})

describe('the socket', () => {
  test('is always encrypted, and always looks names up safely', () => {
    const { url, options } = homeAssistantSocket('https://ha.example.com:8443')
    expect(url).toBe('wss://ha.example.com:8443/api/websocket')
    expect(options.lookup).toBe(publicLookup)
  })
  test.each(['http://ha.example.com', 'https://10.0.0.1', 'https://[fd00::1]'])(
    'never goes to %s',
    (origin) => {
      expect(() => homeAssistantSocket(origin)).toThrow()
    },
  )
  test('the WebSocket client really uses that lookup', async () => {
    resolves.to = [{ address: '127.0.0.1', family: 4 }]
    const { connectHomeAssistant } = await import('./homeAssistant')
    await expect(
      connectHomeAssistant('https://ha.example.com', 'token'),
    ).rejects.toMatchObject({ problem: 'unreachable' })
  })
})
