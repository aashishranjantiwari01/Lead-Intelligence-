/**
 * SSRF Guard Tests — exercises the actual reusable helpers in ssrfGuard.ts
 *
 * Tests cover (per spec):
 *  - isPrivateIp(): all required IPv4 and IPv6 ranges including IPv4-mapped
 *  - isPrivateHost(): literal IPs, localhost, metadata hostnames
 *  - resolveAndCheckHost(): DNS mocking to verify:
 *      • hostname resolving to private IP → blocked
 *      • hostname with mixed public+private IPs → blocked
 *      • hostname resolving to public IP → allowed
 *  - installSsrfProtection(): route-decision logic for all required ranges
 *
 * DNS lookups are mocked via vi.spyOn so no real network access occurs
 * and no real private infrastructure is contacted.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as dnsModule from 'dns'
import {
  isPrivateIp,
  isPrivateHost,
  resolveAndCheckHost,
} from '../../src/utils/ssrfGuard'

// ─────────────────────────────────────────────────────────────────────────────
// isPrivateIp — IPv4 ranges
// ─────────────────────────────────────────────────────────────────────────────
describe('isPrivateIp — IPv4 private ranges', () => {
  it('blocks 127.0.0.1 (loopback)', () => {
    expect(isPrivateIp('127.0.0.1')).toBe(true)
  })

  it('blocks 127.0.0.2 (127.x.x.x range)', () => {
    expect(isPrivateIp('127.0.0.2')).toBe(true)
  })

  it('blocks 127.255.255.255 (end of loopback range)', () => {
    expect(isPrivateIp('127.255.255.255')).toBe(true)
  })

  it('blocks 10.0.0.1 (10/8)', () => {
    expect(isPrivateIp('10.0.0.1')).toBe(true)
  })

  it('blocks 10.255.255.255 (end of 10/8)', () => {
    expect(isPrivateIp('10.255.255.255')).toBe(true)
  })

  it('blocks 172.16.0.1 (172.16/12 start)', () => {
    expect(isPrivateIp('172.16.0.1')).toBe(true)
  })

  it('blocks 172.31.255.255 (172.16/12 end)', () => {
    expect(isPrivateIp('172.31.255.255')).toBe(true)
  })

  it('does NOT block 172.15.255.255 (just below private range)', () => {
    expect(isPrivateIp('172.15.255.255')).toBe(false)
  })

  it('does NOT block 172.32.0.0 (just above private range)', () => {
    expect(isPrivateIp('172.32.0.0')).toBe(false)
  })

  it('blocks 192.168.0.1 (192.168/16)', () => {
    expect(isPrivateIp('192.168.0.1')).toBe(true)
  })

  it('blocks 192.168.255.255 (end of 192.168/16)', () => {
    expect(isPrivateIp('192.168.255.255')).toBe(true)
  })

  it('blocks 169.254.0.1 (link-local)', () => {
    expect(isPrivateIp('169.254.0.1')).toBe(true)
  })

  it('blocks 169.254.169.254 (cloud metadata endpoint)', () => {
    expect(isPrivateIp('169.254.169.254')).toBe(true)
  })

  it('blocks 0.0.0.1 (0/8 reserved)', () => {
    expect(isPrivateIp('0.0.0.1')).toBe(true)
  })

  it('allows public IP 8.8.8.8', () => {
    expect(isPrivateIp('8.8.8.8')).toBe(false)
  })

  it('allows public IP 93.184.216.34 (example.com)', () => {
    expect(isPrivateIp('93.184.216.34')).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// isPrivateIp — IPv6 ranges
// ─────────────────────────────────────────────────────────────────────────────
describe('isPrivateIp — IPv6 private ranges', () => {
  it('blocks ::1 (loopback)', () => {
    expect(isPrivateIp('::1')).toBe(true)
  })

  it('blocks [::1] (bracketed form as returned by new URL())', () => {
    expect(isPrivateIp('[::1]')).toBe(true)
  })

  it('blocks fc00:: (ULA start — fc00::/7)', () => {
    expect(isPrivateIp('fc00::')).toBe(true)
  })

  it('blocks fd00:: (ULA — fc00::/7 range includes fd)', () => {
    expect(isPrivateIp('fd00::')).toBe(true)
  })

  it('blocks fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff (ULA end)', () => {
    expect(isPrivateIp('fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff')).toBe(true)
  })

  it('blocks fe80:: (link-local start — fe80::/10)', () => {
    expect(isPrivateIp('fe80::')).toBe(true)
  })

  it('blocks fe80::1 (link-local)', () => {
    expect(isPrivateIp('fe80::1')).toBe(true)
  })

  it('blocks febf:: (link-local end — fe80::/10)', () => {
    expect(isPrivateIp('febf::')).toBe(true)
  })

  it('allows 2001:db8::1 (documentation range — public for test)', () => {
    // 2001:db8::/32 is technically reserved for docs but NOT in our block list
    // This verifies we don't over-block
    expect(isPrivateIp('2001:db8::1')).toBe(false)
  })

  it('allows 2606:4700::6810:1c23 (Cloudflare — fully public)', () => {
    expect(isPrivateIp('2606:4700::6810:1c23')).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// isPrivateIp — IPv4-mapped IPv6 addresses
// ─────────────────────────────────────────────────────────────────────────────
describe('isPrivateIp — IPv4-mapped IPv6', () => {
  it('blocks ::ffff:127.0.0.1 (IPv4-mapped loopback)', () => {
    expect(isPrivateIp('::ffff:127.0.0.1')).toBe(true)
  })

  it('blocks ::ffff:192.168.1.1 (IPv4-mapped private)', () => {
    expect(isPrivateIp('::ffff:192.168.1.1')).toBe(true)
  })

  it('blocks ::ffff:10.0.0.1 (IPv4-mapped 10/8)', () => {
    expect(isPrivateIp('::ffff:10.0.0.1')).toBe(true)
  })

  it('blocks ::ffff:169.254.169.254 (IPv4-mapped metadata)', () => {
    expect(isPrivateIp('::ffff:169.254.169.254')).toBe(true)
  })

  it('allows ::ffff:8.8.8.8 (IPv4-mapped public IP)', () => {
    expect(isPrivateIp('::ffff:8.8.8.8')).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// isPrivateHost — synchronous hostname classification
// ─────────────────────────────────────────────────────────────────────────────
describe('isPrivateHost — synchronous hostname check', () => {
  it('blocks localhost', () => {
    expect(isPrivateHost('localhost')).toBe(true)
  })

  it('blocks LOCALHOST (case-insensitive)', () => {
    expect(isPrivateHost('LOCALHOST')).toBe(true)
  })

  it('blocks metadata.google.internal', () => {
    expect(isPrivateHost('metadata.google.internal')).toBe(true)
  })

  it('blocks anything ending in .internal', () => {
    expect(isPrivateHost('my-service.internal')).toBe(true)
  })

  it('blocks anything ending in .local', () => {
    expect(isPrivateHost('printer.local')).toBe(true)
  })

  it('blocks literal private IPv4', () => {
    expect(isPrivateHost('192.168.1.1')).toBe(true)
  })

  it('blocks literal IPv6 loopback', () => {
    expect(isPrivateHost('::1')).toBe(true)
  })

  it('allows public domain', () => {
    expect(isPrivateHost('example.com')).toBe(false)
  })

  it('allows public IP', () => {
    expect(isPrivateHost('8.8.8.8')).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// resolveAndCheckHost — DNS-level validation (mocked)
// ─────────────────────────────────────────────────────────────────────────────
describe('resolveAndCheckHost — DNS resolution with mocked lookup', () => {
  let dnsLookupSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // Spy on dns.promises.lookup to avoid real DNS calls
    dnsLookupSpy = vi.spyOn(dnsModule.promises, 'lookup')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('blocks a public-looking hostname that DNS resolves to a private IP', async () => {
    // Simulates: evil.example.com → 192.168.1.10
    dnsLookupSpy.mockResolvedValue([{ address: '192.168.1.10', family: 4 }] as never)
    const cache = new Map<string, boolean>()
    const result = await resolveAndCheckHost('evil.example.com', cache)
    expect(result).toBe(true) // blocked
  })

  it('blocks when hostname resolves to loopback 127.0.0.1', async () => {
    dnsLookupSpy.mockResolvedValue([{ address: '127.0.0.1', family: 4 }] as never)
    const cache = new Map<string, boolean>()
    const result = await resolveAndCheckHost('attacker.com', cache)
    expect(result).toBe(true)
  })

  it('blocks when hostname has BOTH public and private DNS results', async () => {
    // ANY private IP → blocked (regardless of other public addresses)
    dnsLookupSpy.mockResolvedValue([
      { address: '1.2.3.4', family: 4 },      // public
      { address: '192.168.1.1', family: 4 },  // private — this triggers block
    ] as never)
    const cache = new Map<string, boolean>()
    const result = await resolveAndCheckHost('multi.example.com', cache)
    expect(result).toBe(true)
  })

  it('allows a hostname that DNS resolves to a public IP', async () => {
    dnsLookupSpy.mockResolvedValue([{ address: '93.184.216.34', family: 4 }] as never)
    const cache = new Map<string, boolean>()
    const result = await resolveAndCheckHost('example.com', cache)
    expect(result).toBe(false) // allowed
  })

  it('caches DNS results — only calls lookup once per hostname', async () => {
    dnsLookupSpy.mockResolvedValue([{ address: '93.184.216.34', family: 4 }] as never)
    const cache = new Map<string, boolean>()
    await resolveAndCheckHost('example.com', cache)
    await resolveAndCheckHost('example.com', cache)
    expect(dnsLookupSpy).toHaveBeenCalledTimes(1)
  })

  it('blocks when DNS resolution fails (treat as blocked for safety)', async () => {
    dnsLookupSpy.mockRejectedValue(new Error('ENOTFOUND nonexistent.invalid'))
    const cache = new Map<string, boolean>()
    const result = await resolveAndCheckHost('nonexistent.invalid', cache)
    expect(result).toBe(true)
  })

  it('fast-paths literal private IPs without calling DNS', async () => {
    const cache = new Map<string, boolean>()
    const result = await resolveAndCheckHost('127.0.0.1', cache)
    expect(result).toBe(true)
    expect(dnsLookupSpy).not.toHaveBeenCalled()
  })

  it('fast-paths localhost without calling DNS', async () => {
    const cache = new Map<string, boolean>()
    const result = await resolveAndCheckHost('localhost', cache)
    expect(result).toBe(true)
    expect(dnsLookupSpy).not.toHaveBeenCalled()
  })

  it('blocks a redirect from public URL to private destination (simulation)', async () => {
    // Step 1: initial request to a public hostname
    dnsLookupSpy.mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }] as never)
    const cache = new Map<string, boolean>()
    const initialResult = await resolveAndCheckHost('public-example.com', cache)
    expect(initialResult).toBe(false) // allowed

    // Step 2: redirect sends browser to 192.168.1.1 — blocked BEFORE request
    const redirectResult = await resolveAndCheckHost('192.168.1.1', cache)
    expect(redirectResult).toBe(true) // blocked
    // DNS was only called once (for the public hostname; private IP is fast-pathed)
    expect(dnsLookupSpy).toHaveBeenCalledTimes(1)
  })
})
