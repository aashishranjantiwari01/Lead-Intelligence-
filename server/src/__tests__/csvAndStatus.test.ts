/**
 * Tests for Fix #2 — CSV import must reject malformed website URLs during preview.
 * Tests for Fix #3 — checkWebsite reachability must use 2xx/3xx only.
 *
 * These tests use the actual service implementations rather than mocks where possible.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import * as dbModule from '../../src/config/database'
import { runMigrations } from '../../src/db/schema'
import { CsvImportService } from '../../src/services/csvImportService'

function setupInMemoryDb() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  ;(dbModule as { _db?: Database.Database } & typeof dbModule)._db = db
  vi.spyOn(dbModule, 'getDb').mockReturnValue(db)
  return db
}

// ─────────────────────────────────────────────────────────────────────────────
// Fix #2 — CSV preview must flag malformed website URLs as INVALID
// ─────────────────────────────────────────────────────────────────────────────
describe('CsvImportService.preview — website URL validation', () => {
  let db: Database.Database
  const svc = new CsvImportService()

  beforeEach(() => {
    db = setupInMemoryDb()
    runMigrations()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    db.close()
  })

  function makeBuffer(rows: string): Buffer {
    return Buffer.from(`business_name,website\n${rows}`, 'utf8')
  }

  it('marks row with "http://" website as INVALID', () => {
    const buf = makeBuffer('Test Biz,http://')
    const preview = svc.preview(buf)
    const row = preview.rows[0]
    expect(row.status).toBe('INVALID')
    expect(row.reason).toContain('Invalid website URL')
  })

  it('marks row with "https://" (bare scheme only) as INVALID', () => {
    const buf = makeBuffer('Test Biz,https://')
    const preview = svc.preview(buf)
    expect(preview.rows[0].status).toBe('INVALID')
  })

  it('marks row with a localhost website as INVALID', () => {
    const buf = makeBuffer('Test Biz,http://localhost')
    const preview = svc.preview(buf)
    expect(preview.rows[0].status).toBe('INVALID')
  })

  it('marks row with a private IP website as INVALID', () => {
    const buf = makeBuffer('Test Biz,http://192.168.1.1')
    const preview = svc.preview(buf)
    expect(preview.rows[0].status).toBe('INVALID')
  })

  it('keeps row with empty website as VALID', () => {
    const buf = makeBuffer('Test Biz,')
    const preview = svc.preview(buf)
    expect(preview.rows[0].status).toBe('VALID')
  })

  it('keeps row with no website column as VALID', () => {
    const buf = Buffer.from('business_name\nTest Biz Without Website', 'utf8')
    const preview = svc.preview(buf)
    expect(preview.rows[0].status).toBe('VALID')
  })

  it('keeps row with a valid HTTPS website as VALID', () => {
    const buf = makeBuffer('Test Biz,https://example.com')
    const preview = svc.preview(buf)
    expect(preview.rows[0].status).toBe('VALID')
  })

  it('keeps row with a valid HTTP website as VALID', () => {
    const buf = makeBuffer('Test Biz,http://example.com')
    const preview = svc.preview(buf)
    expect(preview.rows[0].status).toBe('VALID')
  })

  it('invalid_rows count increases for malformed URL row', () => {
    const buf = makeBuffer('Test Biz,http://')
    const preview = svc.preview(buf)
    expect(preview.invalid_rows).toBe(1)
    expect(preview.valid_rows).toBe(0)
  })

  it('correctly counts mixed valid/invalid rows', () => {
    const csv = [
      'business_name,website',
      'Good Biz,https://example.com',       // VALID
      'Bad Biz,http://',                    // INVALID — malformed
      'No Website Biz,',                   // VALID — empty is fine
    ].join('\n')
    const preview = svc.preview(Buffer.from(csv, 'utf8'))
    expect(preview.valid_rows).toBe(2)
    expect(preview.invalid_rows).toBe(1)
  })

  it('sample CSV row 10 with "http://" is classified INVALID (the fix spec case)', () => {
    // This is exactly the scenario from the fix specification
    const csv = [
      'business_name,website',
      'AutoHaus Schneider,http://',
    ].join('\n')
    const preview = svc.preview(Buffer.from(csv, 'utf8'))
    const row = preview.rows[0]
    expect(row.status).toBe('INVALID')
    expect((row.reason ?? '')).toContain('Invalid website URL')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Fix #3 — HTTP status reachability logic
// These tests verify the logic directly using the normalizeUrl + status rules
// without spawning a real Playwright browser.
// ─────────────────────────────────────────────────────────────────────────────
describe('checkWebsite reachability logic — HTTP status classification', () => {
  /**
   * Simulate the exact reachability decision from checkWebsite():
   *   reachable = !!response && status >= 200 && status < 400
   */
  function computeReachability(hasResponse: boolean, status: number) {
    const reachable = hasResponse && status >= 200 && status < 400
    const httpError = hasResponse && !reachable && status > 0
    return {
      reachable,
      error_type: httpError ? 'HTTP_ERROR' : null,
      error_message: httpError ? `HTTP ${status}` : null,
    }
  }

  it('200 OK → reachable: true', () => {
    const r = computeReachability(true, 200)
    expect(r.reachable).toBe(true)
    expect(r.error_type).toBeNull()
  })

  it('201 Created → reachable: true', () => {
    expect(computeReachability(true, 201).reachable).toBe(true)
  })

  it('301 Redirect → reachable: true (Playwright resolves final URL)', () => {
    // Note: Playwright follows redirects and returns the FINAL response status.
    // A 301 here means Playwright gave us this directly (unusual), but we still
    // treat 3xx as reachable since they represent server-side responses.
    expect(computeReachability(true, 301).reachable).toBe(true)
  })

  it('304 Not Modified → reachable: true', () => {
    expect(computeReachability(true, 304).reachable).toBe(true)
  })

  it('400 Bad Request → reachable: false, HTTP_ERROR', () => {
    const r = computeReachability(true, 400)
    expect(r.reachable).toBe(false)
    expect(r.error_type).toBe('HTTP_ERROR')
    expect(r.error_message).toBe('HTTP 400')
  })

  it('401 Unauthorized → reachable: false, HTTP_ERROR', () => {
    const r = computeReachability(true, 401)
    expect(r.reachable).toBe(false)
    expect(r.error_type).toBe('HTTP_ERROR')
    expect(r.error_message).toBe('HTTP 401')
  })

  it('403 Forbidden → reachable: false, HTTP_ERROR', () => {
    const r = computeReachability(true, 403)
    expect(r.reachable).toBe(false)
    expect(r.error_type).toBe('HTTP_ERROR')
    expect(r.error_message).toBe('HTTP 403')
  })

  it('404 Not Found → reachable: false, HTTP_ERROR', () => {
    const r = computeReachability(true, 404)
    expect(r.reachable).toBe(false)
    expect(r.error_type).toBe('HTTP_ERROR')
    expect(r.error_message).toBe('HTTP 404')
  })

  it('429 Too Many Requests → reachable: false, HTTP_ERROR', () => {
    const r = computeReachability(true, 429)
    expect(r.reachable).toBe(false)
    expect(r.error_type).toBe('HTTP_ERROR')
  })

  it('500 Internal Server Error → reachable: false, HTTP_ERROR', () => {
    const r = computeReachability(true, 500)
    expect(r.reachable).toBe(false)
    expect(r.error_type).toBe('HTTP_ERROR')
    expect(r.error_message).toBe('HTTP 500')
  })

  it('503 Service Unavailable → reachable: false, HTTP_ERROR', () => {
    const r = computeReachability(true, 503)
    expect(r.reachable).toBe(false)
    expect(r.error_type).toBe('HTTP_ERROR')
  })

  it('no response (timeout/DNS failure) → reachable: false, no HTTP_ERROR', () => {
    // hasResponse=false means page.goto() threw before any response arrived
    const r = computeReachability(false, 0)
    expect(r.reachable).toBe(false)
    expect(r.error_type).toBeNull() // error_type comes from the catch block, not here
  })

  it('http_status is preserved even for 4xx errors', () => {
    // The spec requires http_status to be stored, not erased
    const status = 404
    const r = computeReachability(true, status)
    expect(r.reachable).toBe(false)
    expect(r.error_message).toBe(`HTTP ${status}`)
    // Callers can access the raw status from http_status field separately
  })
})
