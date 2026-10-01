import { describe, it, expect } from 'vitest'
import { generateOpportunities } from '../../src/services/opportunityEngine'

describe('generateOpportunities', () => {
  it('generates WEBSITE_REDESIGN for no website', () => {
    const opps = generateOpportunities({
      reachable: false,
      noWebsite: true,
      has_contact_form: false,
      has_booking: false,
      has_whatsapp: false,
      has_clear_cta: false,
      mobile_friendly: null,
      performance_score: null,
      seo_score: null,
    })
    expect(opps.some(o => o.type === 'WEBSITE_REDESIGN')).toBe(true)
    expect(opps.find(o => o.type === 'WEBSITE_REDESIGN')?.priority).toBe('HIGH')
  })

  it('generates BOOKING opportunity when no booking detected', () => {
    const opps = generateOpportunities({
      reachable: true,
      noWebsite: false,
      has_contact_form: true,
      has_booking: false,
      has_whatsapp: false,
      has_clear_cta: true,
      mobile_friendly: true,
      performance_score: 80,
      seo_score: 80,
    })
    expect(opps.some(o => o.type === 'BOOKING')).toBe(true)
  })

  it('does NOT generate BOOKING when booking exists', () => {
    const opps = generateOpportunities({
      reachable: true,
      noWebsite: false,
      has_contact_form: true,
      has_booking: true,
      has_whatsapp: true,
      has_clear_cta: true,
      mobile_friendly: true,
      performance_score: 90,
      seo_score: 90,
    })
    expect(opps.some(o => o.type === 'BOOKING')).toBe(false)
  })

  it('generates WHATSAPP opportunity when no WhatsApp', () => {
    const opps = generateOpportunities({
      reachable: true,
      noWebsite: false,
      has_contact_form: true,
      has_booking: true,
      has_whatsapp: false,
      has_clear_cta: true,
      mobile_friendly: true,
      performance_score: 90,
      seo_score: 90,
    })
    expect(opps.some(o => o.type === 'WHATSAPP')).toBe(true)
  })

  it('generates PERFORMANCE opportunity for low performance score', () => {
    const opps = generateOpportunities({
      reachable: true,
      noWebsite: false,
      has_contact_form: true,
      has_booking: true,
      has_whatsapp: true,
      has_clear_cta: true,
      mobile_friendly: true,
      performance_score: 30,
      seo_score: 90,
    })
    expect(opps.some(o => o.type === 'PERFORMANCE')).toBe(true)
  })

  it('generates no duplicate opportunity types', () => {
    const opps = generateOpportunities({
      reachable: false,
      noWebsite: true,
      has_contact_form: false,
      has_booking: false,
      has_whatsapp: false,
      has_clear_cta: false,
      mobile_friendly: false,
      performance_score: 10,
      seo_score: 10,
    })
    const types = opps.map(o => o.type)
    const uniqueTypes = [...new Set(types)]
    expect(types.length).toBe(uniqueTypes.length)
  })

  it('sorts HIGH priority opportunities first', () => {
    const opps = generateOpportunities({
      reachable: true,
      noWebsite: false,
      has_contact_form: false,
      has_booking: false,
      has_whatsapp: false,
      has_clear_cta: false,
      mobile_friendly: false,
      performance_score: 30,
      seo_score: 30,
    })
    const priorities = opps.map(o => o.priority)
    const sorted = ['HIGH', 'MEDIUM', 'LOW']
    let lastIndex = -1
    for (const p of priorities) {
      const idx = sorted.indexOf(p)
      expect(idx).toBeGreaterThanOrEqual(lastIndex)
      lastIndex = idx
    }
  })
})
