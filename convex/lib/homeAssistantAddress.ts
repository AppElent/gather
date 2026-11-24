'use node'

/**
 * Where the Home Assistant connection may go: a public address, whatever the
 * name resolves to at the moment of connecting. The check sits in the
 * socket's own lookup, so a name that answers differently the second time
 * (DNS rebinding) cannot slip between a check and a connect.
 */
import { lookup as dnsLookup } from 'node:dns'
import { BlockList, isIP, type LookupFunction } from 'node:net'
import type { ClientOptions } from 'ws'

const blocked = new BlockList()
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  blocked.addSubnet(network, prefix, 'ipv4')
}
// Inside global unicast: tunnels that wrap an IPv4 address, and documentation.
for (const [network, prefix] of [
  ['2001::', 23],
  ['2001:db8::', 32],
  ['2002::', 16],
] as const) {
  blocked.addSubnet(network, prefix, 'ipv6')
}
const globalUnicast = new BlockList()
globalUnicast.addSubnet('2000::', 3, 'ipv6')

/** Whether an IP address is on the public internet. */
export function isPublicIp(address: string): boolean {
  const family = isIP(address)
  if (family === 4) return !blocked.check(address, 'ipv4')
  if (family === 6) {
    return globalUnicast.check(address, 'ipv6') && !blocked.check(address, 'ipv6')
  }
  return false
}

/** `dns.lookup`, refusing a name when any of its addresses is not public. */
export const publicLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, '', 0)
    const first = addresses[0]
    if (!first || addresses.some((each) => !isPublicIp(each.address))) {
      return callback(new Error('Not a public address'), '', 0)
    }
    if (options.all) return callback(null, addresses)
    callback(null, first.address, first.family)
  })
}

/** The WebSocket address and socket options for a Home Assistant origin. */
export function homeAssistantSocket(origin: string): {
  url: string
  options: ClientOptions & { lookup?: LookupFunction }
} {
  const url = new URL('/api/websocket', origin)
  // A literal address never reaches `lookup`.
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (url.protocol !== 'https:' || (isIP(host) && !isPublicIp(host))) {
    throw new Error('Not a public https address')
  }
  url.protocol = 'wss:'
  return { url: url.toString(), options: { lookup: publicLookup } }
}
