import { describe, it, expect } from 'vitest'
import { normalizeName, normalizePhone, normalizeEmail, assessDuplicateConfidence } from '../../src/utils/normalizeName'

describe('normalizeName', () => {
  it('lowercases and trims whitespace', () => {
    expect(normalizeName(' ABC Dental ')).toBe('abc dental')
  })

  it('collapses multiple spaces', () => {
    expect(normalizeName('ABC  Dental  GmbH')).toBe('abc dental')
  })

  it('strips GmbH suffix', () => {
    expect(normalizeName('ABC Dental GmbH')).toBe('abc dental')
  })

  it('strips AG suffix', () => {
    expect(normalizeName('Tech Solutions AG')).toBe('tech solutions')
  })

  it('strips Ltd suffix', () => {
    expect(normalizeName('Smith Plumbing Ltd')).toBe('smith plumbing')
  })

  it('makes probable duplicates match', () => {
    const a = normalizeName('ABC Dental GmbH')
    const b = normalizeName('abc dental gmbh')
    const c = normalizeName(' ABC Dental GmbH ')
    expect(a).toBe(b)
    expect(b).toBe(c)
  })

  it('returns empty string for null', () => {
    expect(normalizeName(null)).toBe('')
  })

  it('removes punctuation', () => {
    // Apostrophes are stripped but surrounding spaces are preserved for fuzzy match
    expect(normalizeName("O'Brien's Café")).toBe('o brien s café')
  })
})

describe('normalizePhone', () => {
  it('strips spaces and dashes', () => {
    expect(normalizePhone('+41 44 123 45 67')).toBe('+41441234567')
  })

  it('strips parentheses', () => {
    expect(normalizePhone('+1 (800) 555-1234')).toBe('+18005551234')
  })

  it('returns null for null', () => {
    expect(normalizePhone(null)).toBeNull()
  })

  it('returns null for short/invalid phone', () => {
    expect(normalizePhone('123')).toBeNull()
  })
})

describe('normalizeEmail', () => {
  it('lowercases email', () => {
    expect(normalizeEmail('INFO@EXAMPLE.COM')).toBe('info@example.com')
  })

  it('trims whitespace', () => {
    expect(normalizeEmail(' info@example.com ')).toBe('info@example.com')
  })

  it('returns null for invalid email', () => {
    expect(normalizeEmail('notanemail')).toBeNull()
  })

  it('returns null for null', () => {
    expect(normalizeEmail(null)).toBeNull()
  })
})

describe('assessDuplicateConfidence', () => {
  it('returns HIGH confidence for HIGH signal', () => {
    const result = assessDuplicateConfidence([
      { type: 'NORMALIZED_NAME_CITY', confidence: 'HIGH', description: 'Name match' }
    ])
    expect(result.isDuplicate).toBe(true)
    expect(result.confidence).toBe('HIGH')
  })

  it('returns MEDIUM confidence for single MEDIUM signal', () => {
    const result = assessDuplicateConfidence([
      { type: 'PHONE', confidence: 'MEDIUM', description: 'Phone match' }
    ])
    expect(result.isDuplicate).toBe(false)
    expect(result.confidence).toBe('MEDIUM')
  })

  it('returns HIGH for multiple MEDIUM signals', () => {
    const result = assessDuplicateConfidence([
      { type: 'PHONE', confidence: 'MEDIUM', description: 'Phone match' },
      { type: 'WEBSITE_DOMAIN', confidence: 'MEDIUM', description: 'Domain match' }
    ])
    expect(result.isDuplicate).toBe(true)
    expect(result.confidence).toBe('HIGH')
  })

  it('returns NONE for empty signals', () => {
    const result = assessDuplicateConfidence([])
    expect(result.isDuplicate).toBe(false)
    expect(result.confidence).toBe('NONE')
  })
})
