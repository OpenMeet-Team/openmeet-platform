import { describe, it, expect } from 'vitest'
import { getMatrixDisplayName } from '../../../../src/utils/matrixUtils'

describe('Matrix Utils', () => {
  describe('getMatrixDisplayName', () => {
    it('should extract username from Matrix ID', () => {
      expect(getMatrixDisplayName('@alice:matrix.org')).toBe('alice')
      expect(getMatrixDisplayName('@bob:example.com')).toBe('bob')
    })

    it('should return original ID if pattern doesn\'t match', () => {
      expect(getMatrixDisplayName('invalid-id')).toBe('invalid-id')
    })

    it('should return "Unknown User" for empty input', () => {
      expect(getMatrixDisplayName('')).toBe('Unknown User')
    })
  })
})
