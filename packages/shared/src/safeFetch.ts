/**
 * fetch() for URLs that merchants supply (product pages to scrape).
 *
 * A plain fetch of a user URL let anyone read cloud metadata
 * (http://169.254.169.254/...), the API's own localhost endpoints, or other
 * internal services, and the scraped text came back in the API response. Every
 * hop, redirects included, must resolve only to public addresses.
 *
 * Residual risk: fetch resolves the host again after this check, so a DNS name
 * that flips between a public and a private address (rebinding) can still slip
 * through. Closing that needs a pinned-address dispatcher.
 */

import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

const MAX_REDIRECTS = 5;

const blocked = new BlockList();
// IPv4: this-network, private, CGNAT, loopback, link-local (cloud metadata),
// IETF protocol assignments, TEST-NETs, benchmarking, multicast and reserved.
for (const [net, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  blocked.addSubnet(net, prefix, 'ipv4');
}
// IPv6: unspecified, loopback, NAT64, discard, unique-local, link-local, multicast.
for (const [net, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96],
  ['100::', 64],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  blocked.addSubnet(net, prefix, 'ipv6');
}

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeUrlError';
  }
}

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blocked.check(address, 'ipv4');
  if (family === 6) {
    // IPv4-mapped (::ffff:a.b.c.d) is judged by the IPv4 address it carries.
    const mapped = address.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return !blocked.check(mapped[1], 'ipv4');
    return !blocked.check(address, 'ipv6');
  }
  return false;
}

/** Throws UnsafeUrlError unless the URL is http(s) and every address its host resolves to is public. */
export async function assertPublicUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError('Invalid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UnsafeUrlError('Only http and https URLs are allowed');
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError('URLs with credentials are not allowed');
  }

  const host = url.hostname.replace(/^\[|\]$/g, '');
  let addresses: string[];
  if (isIP(host)) {
    addresses = [host];
  } else {
    try {
      addresses = (await lookup(host, { all: true, verbatim: true })).map((entry) => entry.address);
    } catch {
      throw new UnsafeUrlError('Host could not be resolved');
    }
  }
  if (addresses.length === 0 || !addresses.every(isPublicAddress)) {
    throw new UnsafeUrlError('URL points to a private or reserved address');
  }
  return url;
}

/** fetch() that refuses non-public targets and re-checks every redirect hop. */
export async function safeFetch(rawUrl: string, init: RequestInit = {}): Promise<Response> {
  let current = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertPublicUrl(current);
    const response = await fetch(url, { ...init, redirect: 'manual' });
    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      current = new URL(location, url).toString();
      continue;
    }
    return response;
  }
  throw new UnsafeUrlError('Too many redirects');
}
