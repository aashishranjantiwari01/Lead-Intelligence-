import { describe, it, expect } from 'vitest'
import { calculateLeadScore } from '../../src/services/leadScoringService'
import type { Lead } from '@lie/shared'

const baseLead: Lead = {
  id: 1,
  business_name: 'Test Business',
  normalized_name: 'test business',
  category: 'Dentist',
  country: 'Switzerland',
  city: 'Zurich',
  address: null,
  phone: '+41441234567',
  email: 'info@test.com',
  website: 'https://test.com',
  instagram: 'https://instagram.com/test',
  facebook: null,
  linkedin: null,
  source: 'MANUAL',
  source_url: null,
  website_status: 'REACHABLE',
  website_score: 75,
  automation_score: null,
  lead_score: null,
  lead_status: 'NEW',
  notes: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  last_audited_at: null,
}

describe('calculateLeadScore', () => {
  it('awards +30 for no website', () => {
    const lead = { ...baseLead, website: null }
    const result = calculateLeadScore(lead, null)
    const noWebsiteReason = result.reasons.find(r => r.label.includes('No website'))
    expect(noWebsiteReason).toBeDefined()
    expect(noWebsiteReason!.points).toBe(30)
  })

  it('awards +25 for unreachable website', () => {
    const result = calculateLeadScore(baseLead, {
      reachable: false,
      performance_score: null,
      seo_score: null,
      has_contact_form: false,
      has_booking: false,
      has_whatsapp: false,
      has_clear_cta: false,
      mobile_friendly: null,
    })
    const reason = result.reasons.find(r => r.label.includes('unreachable'))
    expect(reason).toBeDefined()
    expect(reason!.points).toBe(25)
  })

  it('awards +5 for email available', () => {
    const result = calculateLeadScore(baseLead, {
      reachable: true,
      performance_score: 80,
      seo_score: 80,
      has_contact_form: true,
      has_booking: true,
      has_whatsapp: true,
      has_clear_cta: true,
      mobile_friendly: true,
    })
    const reason = result.reasons.find(r => r.label.includes('Email'))
    expect(reason).toBeDefined()
    expect(reason!.points).toBe(5)
  })

  it('awards +5 for phone available', () => {
    const result = calculateLeadScore(baseLead, {
      reachable: true,
      performance_score: 80,
      seo_score: 80,
      has_contact_form: true,
      has_booking: true,
      has_whatsapp: true,
      has_clear_cta: true,
      mobile_friendly: true,
    })
    const reason = result.reasons.find(r => r.label.includes('Phone'))
    expect(reason).toBeDefined()
    expect(reason!.points).toBe(5)
  })

  it('caps score at 100', () => {
    // Lead with no website, no email, no phone but maximum missing features
    const lead = { ...baseLead, website: null, email: null, phone: null }
    const result = calculateLeadScore(lead, null)
    expect(result.total).toBeLessThanOrEqual(100)
  })

  it('score total matches sum of reasons', () => {
    const result = calculateLeadScore(baseLead, null)
    const sum = result.reasons.reduce((a, b) => a + b.points, 0)
    expect(result.total).toBe(Math.min(100, sum))
  })

  it('awards +10 for mobile issues', () => {
    const result = calculateLeadScore(baseLead, {
      reachable: true,
      performance_score: 80,
      seo_score: 80,
      has_contact_form: true,
      has_booking: true,
      has_whatsapp: true,
      has_clear_cta: true,
      mobile_friendly: false,
    })
    const reason = result.reasons.find(r => r.label.includes('Mobile'))
    expect(reason).toBeDefined()
    expect(reason!.points).toBe(10)
  })
})
