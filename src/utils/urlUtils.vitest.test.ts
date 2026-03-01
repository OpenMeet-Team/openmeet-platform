import { describe, it, expect } from 'vitest'
import { ensureAbsoluteUrl } from './urlUtils'

describe('ensureAbsoluteUrl', () => {
  it('should prepend https:// to a bare domain', () => {
    expect(ensureAbsoluteUrl('zoom.us')).toBe('https://zoom.us')
  })

  it('should prepend https:// to a domain with path', () => {
    expect(ensureAbsoluteUrl('meet.google.com/abc-xyz')).toBe('https://meet.google.com/abc-xyz')
  })

  it('should not modify a URL that already has https://', () => {
    expect(ensureAbsoluteUrl('https://zoom.us')).toBe('https://zoom.us')
  })

  it('should not modify a URL that already has http://', () => {
    expect(ensureAbsoluteUrl('http://zoom.us')).toBe('http://zoom.us')
  })

  it('should not modify a protocol-relative URL', () => {
    expect(ensureAbsoluteUrl('//zoom.us')).toBe('//zoom.us')
  })

  it('should return empty string as-is', () => {
    expect(ensureAbsoluteUrl('')).toBe('')
  })

  it('should handle undefined', () => {
    expect(ensureAbsoluteUrl(undefined as unknown as string)).toBe('')
  })

  it('should handle null', () => {
    expect(ensureAbsoluteUrl(null as unknown as string)).toBe('')
  })

  it('should handle a URL with port number', () => {
    expect(ensureAbsoluteUrl('localhost:8080/meeting')).toBe('https://localhost:8080/meeting')
  })

  it('should handle HTTPS in mixed case', () => {
    expect(ensureAbsoluteUrl('HTTPS://zoom.us')).toBe('HTTPS://zoom.us')
  })

  it('should handle HTTP in mixed case', () => {
    expect(ensureAbsoluteUrl('Http://zoom.us')).toBe('Http://zoom.us')
  })
})
