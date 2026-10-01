/**
 * ssrfGuard.ts — Canonical SSRF protection for the Lead Intelligence Engine.
 *
 * This is the ONE source of truth for request/host validation.
 * Used in BOTH checkWebsite() and the full audit page in runWebsiteAudit().
 *
 * Design:
 *  - isPrivateIp(ip)         — classify a literal IP string (IPv4 or IPv6)
 *  - isPrivateHost(hostname) — classify a hostname/IP string (fast, synchronous)
 *  - resolveAndCheckHost(h)  — resolve a hostname via DNS, classify all IPs
 *  - installSsrfProtection(page, dnsCache) — attach page.route() interceptor
 *
 * IP range coverage (Part B):
 *   IPv4:  127/8, 10/8, 172.16/12, 192.168/16, 169.254/16, 0/8, 100.64/10
 *   IPv6:  ::1, fc00::/7 (ULA), fe80::/10 (link-local), ::ffff:0:0/96 (IPv4-mapped)
 *
 * IMPORTANT NOTE on JavaScript bitwise arithmetic:
 *   JS bitwise operators (&, |, etc.) work on SIGNED 32-bit integers.
 *   Hex literals above 0x7FFFFFFF are treated as positive floats (not 32-bit ints).
 *   Therefore ALL comparisons use (value >>> 0) to force unsigned 32-bit before
 *   comparing, so both sides have the same type.
 */

import * as net from 'net';
import * as dns from 'dns';
import type { Page } from 'playwright';

// ─────────────────────────────────────────────────────────────────────────────
// IPv4 classification
// ─────────────────────────────────────────────────────────────────────────────

/** Convert a dotted-decimal IPv4 string to an unsigned 32-bit integer. Returns null if invalid. */
function ipv4ToUint32(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    const n = parseInt(part, 10);
    if (isNaN(n) || n < 0 || n > 255 || part.trim() === '') return null;
    result = (result * 256) + n;
  }
  // Force unsigned 32-bit — critical for correct comparisons with high-range IPs
  return result >>> 0;
}

/** Mask and compare, both forced to unsigned 32-bit to avoid sign issues. */
function cidrMatch(ip32: number, network: number, maskBits: number): boolean {
  const mask = maskBits === 0 ? 0 : (~0 << (32 - maskBits));
  return ((ip32 & mask) >>> 0) === ((network & mask) >>> 0);
}

/** Check whether a dotted-decimal IPv4 string falls into any private/reserved range. */
function isPrivateIpv4(ip: string): boolean {
  const n = ipv4ToUint32(ip);
  if (n === null) return false;

  // 0.0.0.0/8   — starts at 0x00000000
  if (cidrMatch(n, 0x00000000, 8)) return true;
  // 10.0.0.0/8
  if (cidrMatch(n, 0x0A000000, 8)) return true;
  // 100.64.0.0/10 — Carrier-grade NAT
  if (cidrMatch(n, 0x64400000, 10)) return true;
  // 127.0.0.0/8 — loopback
  if (cidrMatch(n, 0x7F000000, 8)) return true;
  // 169.254.0.0/16 — link-local / cloud metadata
  if (cidrMatch(n, 0xA9FE0000, 16)) return true;
  // 172.16.0.0/12
  if (cidrMatch(n, 0xAC100000, 12)) return true;
  // 192.168.0.0/16
  if (cidrMatch(n, 0xC0A80000, 16)) return true;
  // 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 — TEST-NET (RFC 5737)
  if (cidrMatch(n, 0xC0000200, 24)) return true;
  if (cidrMatch(n, 0xC6336400, 24)) return true;
  if (cidrMatch(n, 0xCB007100, 24)) return true;
  // 240.0.0.0/4 — reserved (E class)
  if (cidrMatch(n, 0xF0000000, 4)) return true;

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// IPv6 classification
// ─────────────────────────────────────────────────────────────────────────────

/** Expand an IPv6 address to its full 32-hex-char form. Returns null if not valid IPv6. */
function expandIpv6(raw: string): string | null {
  // Strip brackets: [::1] → ::1
  const stripped = raw.replace(/^\[|\]$/g, '');
  if (!net.isIPv6(stripped)) return null;

  // Handle ::ffff:a.b.c.d (IPv4-mapped) — normalise to hex form
  const v4mapped = stripped.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (v4mapped) {
    const n = ipv4ToUint32(v4mapped[1]);
    if (n === null) return null;
    const hi = (n >>> 16) & 0xFFFF;
    const lo = n & 0xFFFF;
    return `00000000000000000000ffff${hi.toString(16).padStart(4, '0')}${lo.toString(16).padStart(4, '0')}`;
  }

  // Expand :: notation
  const halves = stripped.split('::');
  let groups: string[];
  if (halves.length === 2) {
    const left = halves[0] ? halves[0].split(':') : [];
    const right = halves[1] ? halves[1].split(':') : [];
    const missing = 8 - left.length - right.length;
    groups = [...left, ...Array(missing).fill('0'), ...right];
  } else if (halves.length === 1) {
    groups = stripped.split(':');
  } else {
    return null; // malformed
  }
  if (groups.length !== 8) return null;
  return groups.map(g => g.padStart(4, '0')).join('');
}

/** Check whether an IPv6 address falls into any private/reserved range. */
function isPrivateIpv6(raw: string): boolean {
  const stripped = raw.replace(/^\[|\]$/g, '');
  const expanded = expandIpv6(stripped);
  if (!expanded || expanded.length !== 32) return false;

  // ::1 — loopback
  if (expanded === '00000000000000000000000000000001') return true;
  // :: — unspecified
  if (expanded === '00000000000000000000000000000000') return true;

  // First byte (bits 0-7) — used for fc00::/7 check
  const byte0 = parseInt(expanded.slice(0, 2), 16);

  // fc00::/7 — Unique Local Addresses (fc00–fdff: high 7 bits = 1111110x)
  if ((byte0 & 0xFE) === 0xFC) return true;

  // fe80::/10 — link-local (high 10 bits = 1111111010xxxxxx)
  const firstTwoBytes = parseInt(expanded.slice(0, 4), 16);
  if ((firstTwoBytes & 0xFFC0) === 0xFE80) return true;

  // ::ffff:0:0/96 — IPv4-mapped IPv6
  // The first 80 bits are 0, next 16 bits are 0xFFFF
  if (expanded.startsWith('0'.repeat(20) + 'ffff')) {
    // Extract embedded IPv4 from last 32 bits
    const embeddedHex = expanded.slice(24);
    const hi = parseInt(embeddedHex.slice(0, 4), 16);
    const lo = parseInt(embeddedHex.slice(4, 8), 16);
    const ipv4Int = (((hi << 16) | lo) >>> 0);
    const a = (ipv4Int >>> 24) & 0xFF;
    const b = (ipv4Int >>> 16) & 0xFF;
    const c = (ipv4Int >>> 8) & 0xFF;
    const d = ipv4Int & 0xFF;
    return isPrivateIpv4(`${a}.${b}.${c}.${d}`);
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API: isPrivateIp / isPrivateHost
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Classify a literal IP address string (IPv4 or IPv6) as private/reserved.
 * Returns true if the IP is private/internal and should be blocked.
 * Handles bracket notation (e.g. [::1]) as returned by new URL().
 */
export function isPrivateIp(ip: string): boolean {
  // Strip brackets for IPv6: [::1] → ::1
  const stripped = ip.replace(/^\[|\]$/g, '');
  if (net.isIPv4(stripped)) return isPrivateIpv4(stripped);
  if (net.isIPv6(stripped)) return isPrivateIpv6(stripped);
  return false;
}

/**
 * Synchronous host classification. Works for:
 *  - Literal IPv4 addresses
 *  - Literal IPv6 addresses (with or without brackets)
 *  - Known private hostnames (localhost, metadata endpoints, .internal, .local)
 *
 * For hostnames that need DNS resolution, use resolveAndCheckHost() instead.
 */
export function isPrivateHost(hostname: string): boolean {
  if (!hostname) return false;

  // Known private hostnames
  const lower = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (lower === 'localhost') return true;
  if (lower === 'metadata.google.internal') return true;
  if (lower.endsWith('.internal')) return true;
  if (lower.endsWith('.local')) return true;

  // Literal IP addresses (IPv4 and IPv6)
  return isPrivateIp(hostname);
}

// ─────────────────────────────────────────────────────────────────────────────
// DNS-aware host validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve a hostname via DNS and check every returned IP for private ranges.
 * Returns true (block) if:
 *  - The hostname is already identified as private by isPrivateHost()
 *  - ANY resolved IP is private/internal
 * Returns false (allow) only if all resolved IPs are public.
 *
 * DNS resolution failures are treated as BLOCKED (fail-safe).
 *
 * @param hostname  The hostname to validate (not a full URL)
 * @param cache     Per-audit DNS cache — pass the same Map for a given context
 */
export async function resolveAndCheckHost(
  hostname: string,
  cache: Map<string, boolean>
): Promise<boolean> {
  if (!hostname) return true; // block empty

  // Fast path: synchronous check first (avoids unnecessary DNS calls)
  if (isPrivateHost(hostname)) return true;

  // Cache hit — same hostname already resolved for this audit context
  if (cache.has(hostname)) return cache.get(hostname)!;

  try {
    const results = await dns.promises.lookup(hostname, { all: true, family: 0 });
    // Block if ANY resolved address is private
    const hasPrivate = results.some(r => isPrivateIp(r.address));
    cache.set(hostname, hasPrivate);
    return hasPrivate;
  } catch {
    // DNS resolution failed → treat as blocked (fail-safe)
    cache.set(hostname, true);
    return true;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Playwright integration — the reusable guard
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Attach SSRF protection to a Playwright page via request interception.
 *
 * Every HTTP/HTTPS request (initial navigation + every resource + every redirect)
 * is validated BEFORE the network call is made:
 *  1. Parse the URL
 *  2. If hostname is a literal private IP/hostname → abort immediately (sync)
 *  3. If hostname is a domain name → resolve DNS and abort if any IP is private
 *  4. Only call route.continue() after validation passes
 *
 * Non-HTTP requests (data:, blob:, etc.) are passed through unchanged.
 *
 * @param page       Playwright Page to protect
 * @param dnsCache   Optional shared Map for DNS cache (one per audit context)
 */
export async function installSsrfProtection(
  page: Page,
  dnsCache: Map<string, boolean> = new Map()
): Promise<void> {
  await page.route('**/*', async (route) => {
    const requestUrl = route.request().url();

    // Only validate HTTP/HTTPS requests — data:, blob:, etc. are browser-internal
    if (!requestUrl.startsWith('http://') && !requestUrl.startsWith('https://')) {
      await route.continue();
      return;
    }

    let hostname: string;
    try {
      hostname = new URL(requestUrl).hostname;
    } catch {
      // Unparseable URL → abort
      await route.abort('failed');
      return;
    }

    // Remove IPv6 brackets before classification: [::1] → ::1
    const cleanHostname = hostname.replace(/^\[|\]$/g, '');

    try {
      const blocked = await resolveAndCheckHost(cleanHostname, dnsCache);
      if (blocked) {
        await route.abort('accessdenied');
        return;
      }
    } catch {
      // Safety: if check throws unexpectedly, abort
      await route.abort('accessdenied');
      return;
    }

    await route.continue();
  });
}
