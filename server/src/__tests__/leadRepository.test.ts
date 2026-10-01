import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import * as dbModule from '../../src/config/database'
import { runMigrations } from '../../src/db/schema'
import { LeadRepository } from '../../src/db/LeadRepository'

// We need to inject an in-memory DB to avoid touching the real file
function setupInMemoryDb() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  // Monkey-patch getDb() so the repository uses our in-memory DB
  ;(dbModule as { _db?: Database.Database } & typeof dbModule)._db = db
  // Override getDb to return the in-memory DB
  vi.spyOn(dbModule, 'getDb').mockReturnValue(db)
  return db
}

describe('LeadRepository.create — notes', () => {
  let db: Database.Database

  beforeEach(() => {
    db = setupInMemoryDb()
    runMigrations()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    db.close()
  })

  it('persists notes when provided at creation', () => {
    const repo = new LeadRepository()
    const lead = repo.create({
      business_name: 'Example Business',
      normalized_name: 'example business',
      notes: 'Potential website redesign prospect',
    })
    expect(lead.notes).toBe('Potential website redesign prospect')
  })

  it('stores null when no notes provided at creation', () => {
    const repo = new LeadRepository()
    const lead = repo.create({
      business_name: 'No Notes Business',
      normalized_name: 'no notes business',
    })
    expect(lead.notes).toBeNull()
  })
})

describe('LeadRepository.findAll — pagination', () => {
  let db: Database.Database

  beforeEach(() => {
    db = setupInMemoryDb()
    runMigrations()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    db.close()
  })

  function seedLeads(repo: LeadRepository, count: number) {
    for (let i = 1; i <= count; i++) {
      repo.create({
        business_name: `Business ${i}`,
        normalized_name: `business ${i}`,
      })
    }
  }

  it('returns first page correctly', () => {
    const repo = new LeadRepository()
    seedLeads(repo, 30)

    const result = repo.findAll({ page: 1, limit: 10 } as Parameters<typeof repo.findAll>[0])
    expect(result.leads).toHaveLength(10)
    expect(result.total).toBe(30)
    expect(result.page).toBe(1)
    expect(result.limit).toBe(10)
    expect(result.total_pages).toBe(3)
  })

  it('returns second page correctly', () => {
    const repo = new LeadRepository()
    seedLeads(repo, 30)

    const result = repo.findAll({ page: 2, limit: 10 } as Parameters<typeof repo.findAll>[0])
    expect(result.leads).toHaveLength(10)
    expect(result.page).toBe(2)
  })

  it('returns partial last page', () => {
    const repo = new LeadRepository()
    seedLeads(repo, 25)

    const result = repo.findAll({ page: 3, limit: 10 } as Parameters<typeof repo.findAll>[0])
    expect(result.leads).toHaveLength(5)
  })

  it('total count matches even on paginated pages', () => {
    const repo = new LeadRepository()
    seedLeads(repo, 17)

    const result = repo.findAll({ page: 2, limit: 10 } as Parameters<typeof repo.findAll>[0])
    expect(result.total).toBe(17)
    expect(result.total_pages).toBe(2)
  })
})

describe('LeadRepository.getDashboardStats — missing website', () => {
  let db: Database.Database

  beforeEach(() => {
    db = setupInMemoryDb()
    runMigrations()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    db.close()
  })

  it('counts leads with null website as missing', () => {
    const repo = new LeadRepository()
    repo.create({ business_name: 'No Website', normalized_name: 'no website' })
    repo.create({ business_name: 'Has Website', normalized_name: 'has website', website: 'https://example.com' })

    const stats = repo.getDashboardStats()
    expect(stats.websites_missing).toBe(1)
  })

  it('counts leads with empty string website as missing', () => {
    const repo = new LeadRepository()
    repo.create({ business_name: 'Empty Website', normalized_name: 'empty website', website: '' })
    repo.create({ business_name: 'Has Website', normalized_name: 'has website', website: 'https://example.com' })

    const stats = repo.getDashboardStats()
    expect(stats.websites_missing).toBe(1)
  })

  it('does NOT count leads with a website as missing even if unchecked', () => {
    const repo = new LeadRepository()
    // Lead with a website URL but website_status = UNCHECKED (default)
    repo.create({ business_name: 'Unchecked Website', normalized_name: 'unchecked website', website: 'https://example.com' })

    const stats = repo.getDashboardStats()
    expect(stats.websites_missing).toBe(0)
  })
})

describe('LeadRepository.getDashboardStats — automation opportunities', () => {
  let db: Database.Database

  beforeEach(() => {
    db = setupInMemoryDb()
    runMigrations()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    db.close()
  })

  function insertAudit(leadId: number, opportunitiesJson: string) {
    db.prepare(`
      INSERT INTO website_audits (lead_id, url, reachable, https_enabled, issues_json, opportunities_json)
      VALUES (?, 'https://test.com', 1, 1, '[]', ?)
    `).run(leadId, opportunitiesJson)
  }

  it('counts zero automation opportunities when no audits exist', () => {
    const repo = new LeadRepository()
    repo.create({ business_name: 'Test', normalized_name: 'test' })
    const stats = repo.getDashboardStats()
    expect(stats.automation_opportunities).toBe(0)
  })

  it('counts distinct leads with automation opps — NOT audit rows', () => {
    const repo = new LeadRepository()
    const lead = repo.create({ business_name: 'Test Lead', normalized_name: 'test lead', website: 'https://test.com' })
    // Same lead audited 3 times with a WHATSAPP opportunity
    const opps = JSON.stringify([{ type: 'WHATSAPP', title: 'WhatsApp', reason: 'No WhatsApp', priority: 'MEDIUM' }])
    insertAudit(lead.id, opps)
    insertAudit(lead.id, opps)
    insertAudit(lead.id, opps)

    const stats = repo.getDashboardStats()
    // Must be 1 (distinct lead), NOT 3 (audit rows)
    expect(stats.automation_opportunities).toBe(1)
  })

  it('does NOT count website-only opportunities as automation', () => {
    const repo = new LeadRepository()
    const lead = repo.create({ business_name: 'Web Only', normalized_name: 'web only', website: 'https://test.com' })
    // Only website/performance opportunities — NOT automation types
    const opps = JSON.stringify([
      { type: 'PERFORMANCE', title: 'Performance', reason: 'Slow', priority: 'MEDIUM' },
      { type: 'SEO', title: 'SEO', reason: 'Bad SEO', priority: 'MEDIUM' },
    ])
    insertAudit(lead.id, opps)

    const stats = repo.getDashboardStats()
    expect(stats.automation_opportunities).toBe(0)
    // But website_opportunities should be 1
    expect(stats.website_opportunities).toBe(1)
  })

  it('counts BOOKING as an automation opportunity', () => {
    const repo = new LeadRepository()
    const lead = repo.create({ business_name: 'Booking Test', normalized_name: 'booking test', website: 'https://test.com' })
    const opps = JSON.stringify([{ type: 'BOOKING', title: 'Booking', reason: 'No booking', priority: 'HIGH' }])
    insertAudit(lead.id, opps)

    const stats = repo.getDashboardStats()
    expect(stats.automation_opportunities).toBe(1)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Fix #2 spec — has_website filter checks actual lead.website field, NOT audit
// ────────────────────────────────────────────────────────────────────────────
describe('LeadRepository.findAll — has_website filter', () => {
  let db: Database.Database

  beforeEach(() => {
    db = setupInMemoryDb()
    runMigrations()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    db.close()
  })

  it('includes leads with NULL website when has_website=false', () => {
    const repo = new LeadRepository()
    repo.create({ business_name: 'Lead A', normalized_name: 'lead a' }) // website = null by default

    const result = repo.findAll({ has_website: false })
    expect(result.leads).toHaveLength(1)
    expect(result.leads[0].business_name).toBe('Lead A')
  })

  it('includes leads with empty-string website when has_website=false', () => {
    const repo = new LeadRepository()
    repo.create({ business_name: 'Lead B', normalized_name: 'lead b', website: '' })

    const result = repo.findAll({ has_website: false })
    expect(result.leads).toHaveLength(1)
    expect(result.leads[0].business_name).toBe('Lead B')
  })

  it('does NOT include a lead that has a website URL even if audit status is UNCHECKED', () => {
    // Lead C: has a website, website_status defaults to UNCHECKED (never audited)
    // UNCHECKED does NOT mean "missing website" — the fix must exclude this lead
    const repo = new LeadRepository()
    repo.create({
      business_name: 'Lead C',
      normalized_name: 'lead c',
      website: 'https://example.com',
      // website_status is UNCHECKED by default — not yet audited
    })

    const result = repo.findAll({ has_website: false })
    expect(result.leads).toHaveLength(0) // Lead C must NOT appear
  })

  it('only returns leads without websites when mixed', () => {
    const repo = new LeadRepository()
    repo.create({ business_name: 'Lead A (null)', normalized_name: 'lead a null' })
    repo.create({ business_name: 'Lead B (empty)', normalized_name: 'lead b empty', website: '' })
    repo.create({ business_name: 'Lead C (has website)', normalized_name: 'lead c', website: 'https://example.com' })

    const result = repo.findAll({ has_website: false })
    expect(result.total).toBe(2)
    const names = result.leads.map(l => l.business_name)
    expect(names).toContain('Lead A (null)')
    expect(names).toContain('Lead B (empty)')
    expect(names).not.toContain('Lead C (has website)')
  })

  it('returns only leads WITH websites when has_website=true', () => {
    const repo = new LeadRepository()
    repo.create({ business_name: 'No Website', normalized_name: 'no website' })
    repo.create({ business_name: 'Has Website', normalized_name: 'has website', website: 'https://example.com' })

    const result = repo.findAll({ has_website: true })
    expect(result.total).toBe(1)
    expect(result.leads[0].business_name).toBe('Has Website')
  })
})
