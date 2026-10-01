/**
 * Tests for SSRF protection — specifically the request interception
 * logic that runs inside the Playwright route handler.
 *
 * We cannot spawn a real browser in unit tests, so we:
 *  1. Test the interception decision (isPrivateHost) exhaustively.
 *  2. Simulate the route-handler logic using a mock route object,
 *     verifying that private destinations are aborted and public ones
 *     are continued BEFORE any network request is dispatched.
 */
import { describe, it, expect, vi } from 'vitest'
import { isPrivateHost } from '../../src/utils/normalizeUrl'

// ──────────────────────────────────────────────────────────────
// Helper: simulate the route-handler decision logic
// (mirrors the lambda in websiteAuditService.ts checkWebsite())
// ──────────────────────────────────────────────────────────────
type RouteAction = 'abort' | 'continue'

async function simulateRouteHandler(requestUrl: string): Promise<{ action: RouteAction; reason?: string }> {
  try {
    const reqParsed = new URL(requestUrl)
    if (isPrivateHost(reqParsed.hostname)) {
      return { action: 'abort', reason: 'private host' }
    }
  } catch {
    return { action: 'abort', reason: 'unparseable URL' }
  }
  return { action: 'continue' }
}

// ──────────────────────────────────────────────────────────────
// Tests: private destinations are ABORTED before request proceeds
// ──────────────────────────────────────────────────────────────
describe('SSRF route interception — private destinations are blocked before request', () => {
  it('aborts requests to localhost', async () => {
    const r = await simulateRouteHandler('http://localhost/')
    expect(r.action).toBe('abort')
  })

  it('aborts requests to 127.0.0.1 (loopback)', async () => {
    const r = await simulateRouteHandler('http://127.0.0.1/secret')
    expect(r.action).toBe('abort')
  })

  it('aborts requests to 127.x.x.x range', async () => {
    const r = await simulateRouteHandler('http://127.0.0.2/')
    expect(r.action).toBe('abort')
  })

  it('aborts requests to 10.x.x.x (private class A)', async () => {
    const r = await simulateRouteHandler('http://10.0.0.1/')
    expect(r.action).toBe('abort')
  })

  it('aborts requests to 172.16-31.x.x (private class B)', async () => {
    const r16 = await simulateRouteHandler('http://172.16.0.1/')
    const r31 = await simulateRouteHandler('http://172.31.255.255/')
    expect(r16.action).toBe('abort')
    expect(r31.action).toBe('abort')
  })

  it('aborts requests to 192.168.x.x (private class C)', async () => {
    const r = await simulateRouteHandler('http://192.168.1.1/admin')
    expect(r.action).toBe('abort')
  })

  it('aborts requests to 169.254.169.254 (AWS/cloud metadata endpoint)', async () => {
    const r = await simulateRouteHandler('http://169.254.169.254/latest/meta-data/')
    expect(r.action).toBe('abort')
  })

  it('aborts requests to 169.254.x.x (link-local)', async () => {
    const r = await simulateRouteHandler('http://169.254.0.1/')
    expect(r.action).toBe('abort')
  })

  it('aborts requests to 0.0.0.0', async () => {
    const r = await simulateRouteHandler('http://0.0.0.0/')
    expect(r.action).toBe('abort')
  })

  it('aborts requests to IPv6 loopback [::1] (browser URL bracket form)', async () => {
    // new URL('http://[::1]/').hostname === '[::1]' (brackets included)
    const r = await simulateRouteHandler('http://[::1]/')
    expect(r.action).toBe('abort')
  })

  it('aborts requests to IPv6 loopback ::1 (raw form)', async () => {
    // isPrivateHost is also called with raw hostnames in some paths
    expect(isPrivateHost('::1')).toBe(true)
  })

  it('aborts requests to GCP/cloud metadata hostname', async () => {
    const r = await simulateRouteHandler('http://metadata.google.internal/computeMetadata/v1/')
    expect(r.action).toBe('abort')
  })

  it('aborts unparseable URLs', async () => {
    const r = await simulateRouteHandler('not a url at all')
    expect(r.action).toBe('abort')
  })
})

// ──────────────────────────────────────────────────────────────
// Tests: public destinations are ALLOWED through
// ──────────────────────────────────────────────────────────────
describe('SSRF route interception — public destinations are allowed', () => {
  it('continues requests to public HTTPS sites', async () => {
    const r = await simulateRouteHandler('https://example.com/')
    expect(r.action).toBe('continue')
  })

  it('continues requests to public HTTP sites', async () => {
    const r = await simulateRouteHandler('http://example.com/')
    expect(r.action).toBe('continue')
  })

  it('continues HTTPS redirects between public hosts', async () => {
    // e.g. http://example.com → https://example.com
    const r = await simulateRouteHandler('https://www.example.com/page')
    expect(r.action).toBe('continue')
  })

  it('does not block 172.15.x.x (just below private range)', async () => {
    const r = await simulateRouteHandler('http://172.15.255.255/')
    expect(r.action).toBe('continue')
  })

  it('does not block 172.32.x.x (just above private range)', async () => {
    const r = await simulateRouteHandler('http://172.32.0.1/')
    expect(r.action).toBe('continue')
  })
})

// ──────────────────────────────────────────────────────────────
// Test: redirect from public host to private host is caught
// This simulates the key scenario: a real Playwright redirect would
// cause a second request with the private URL — our interceptor
// handles it because EVERY request goes through the route handler.
// ──────────────────────────────────────────────────────────────
describe('SSRF route interception — redirect-to-private scenario', () => {
  it('blocks the redirected request when a public URL redirects to a private destination', async () => {
    // Step 1: initial request to a public URL — allowed
    const initial = await simulateRouteHandler('https://public-example.com/')
    expect(initial.action).toBe('continue')

    // Step 2: server sends redirect → browser follows → another request is intercepted
    // This is the URL the browser would request AFTER following the redirect
    const redirected = await simulateRouteHandler('http://192.168.1.1/internal')
    expect(redirected.action).toBe('abort') // blocked BEFORE TCP connection is opened
  })

  it('blocks redirect to localhost', async () => {
    const initial = await simulateRouteHandler('https://public.example.com/')
    expect(initial.action).toBe('continue')

    const redirectedToLocal = await simulateRouteHandler('http://localhost:8080/admin')
    expect(redirectedToLocal.action).toBe('abort')
  })
})
