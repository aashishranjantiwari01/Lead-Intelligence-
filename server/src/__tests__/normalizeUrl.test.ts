import { describe, it, expect } from 'vitest'
import { normalizeUrl, extractDomain, isPrivateHost } from '../../src/utils/normalizeUrl'

describe('normalizeUrl', () => {
  it('adds https:// when scheme is missing', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com')
  })

  it('preserves existing https://', () => {
    expect(normalizeUrl('https://example.com')).toBe('https://example.com')
  })

  it('preserves existing http:// scheme (does NOT upgrade to https)', () => {
    expect(normalizeUrl('http://example.com')).toBe('http://example.com')
  })

  it('removes trailing slash from root path', () => {
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com')
  })

  it('lowercases hostname', () => {
    expect(normalizeUrl('HTTPS://EXAMPLE.COM')).toBe('https://example.com')
  })

  it('preserves meaningful path', () => {
    expect(normalizeUrl('example.com/services')).toBe('https://example.com/services')
  })

  it('removes trailing slash from path', () => {
    expect(normalizeUrl('example.com/services/')).toBe('https://example.com/services')
  })

  it('returns null for null input', () => {
    expect(normalizeUrl(null)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(normalizeUrl('')).toBeNull()
  })

  it('returns null for localhost (SSRF protection)', () => {
    expect(normalizeUrl('localhost')).toBeNull()
  })

  it('returns null for 127.0.0.1 (SSRF protection)', () => {
    expect(normalizeUrl('http://127.0.0.1')).toBeNull()
  })

  it('returns null for 192.168.x.x (SSRF protection)', () => {
    expect(normalizeUrl('http://192.168.1.1')).toBeNull()
  })

  it('returns null for 10.x.x.x (SSRF protection)', () => {
    expect(normalizeUrl('http://10.0.0.1')).toBeNull()
  })

  it('returns null for AWS metadata endpoint (SSRF protection)', () => {
    expect(normalizeUrl('http://169.254.169.254/metadata')).toBeNull()
  })
})

describe('extractDomain', () => {
  it('extracts domain without www', () => {
    expect(extractDomain('https://www.example.com')).toBe('example.com')
  })

  it('extracts domain from path URL', () => {
    expect(extractDomain('https://example.com/page')).toBe('example.com')
  })

  it('returns null for null', () => {
    expect(extractDomain(null)).toBeNull()
  })
})

describe('isPrivateHost', () => {
  it('identifies localhost', () => {
    expect(isPrivateHost('localhost')).toBe(true)
  })

  it('identifies 127.0.0.1 (loopback)', () => {
    expect(isPrivateHost('127.0.0.1')).toBe(true)
  })

  it('identifies 0.0.0.0', () => {
    expect(isPrivateHost('0.0.0.0')).toBe(true)
  })

  it('identifies 192.168.x.x (private)', () => {
    expect(isPrivateHost('192.168.1.100')).toBe(true)
  })

  it('identifies 10.x.x.x (private class A)', () => {
    expect(isPrivateHost('10.42.0.1')).toBe(true)
  })

  it('identifies 172.16-31.x.x (private class B)', () => {
    expect(isPrivateHost('172.16.0.1')).toBe(true)
    expect(isPrivateHost('172.31.255.255')).toBe(true)
  })

  it('identifies 169.254.x.x (link-local)', () => {
    expect(isPrivateHost('169.254.1.2')).toBe(true)
  })

  it('identifies AWS metadata endpoint 169.254.169.254', () => {
    expect(isPrivateHost('169.254.169.254')).toBe(true)
  })

  it('identifies GCP/cloud metadata hostname', () => {
    expect(isPrivateHost('metadata.google.internal')).toBe(true)
  })

  it('identifies IPv6 loopback ::1', () => {
    expect(isPrivateHost('::1')).toBe(true)
  })

  it('does not flag public domains', () => {
    expect(isPrivateHost('example.com')).toBe(false)
    expect(isPrivateHost('google.com')).toBe(false)
    expect(isPrivateHost('172.15.0.1')).toBe(false) // just outside private range
    expect(isPrivateHost('172.32.0.1')).toBe(false) // just outside private range
  })
})
