/**
 * TDD Tests for Matrix Encryption Bootstrap Service
 *
 * Test-first approach to implement encryption setup with user-chosen passphrase
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { MatrixClient } from 'matrix-js-sdk'
import { MatrixEncryptionBootstrapService } from '../matrixEncryptionBootstrapService'

// Mock Matrix client
const mockMatrixClient = {
  getCrypto: vi.fn(),
  getUserId: vi.fn(() => '@test:example.com')
} as unknown as MatrixClient

const mockCrypto = {
  bootstrapCrossSigning: vi.fn(),
  bootstrapSecretStorage: vi.fn(),
  createRecoveryKeyFromPassphrase: vi.fn(),
  isSecretStorageReady: vi.fn(),
  isCrossSigningReady: vi.fn()
}

describe('MatrixEncryptionBootstrapService', () => {
  let service: MatrixEncryptionBootstrapService

  beforeEach(() => {
    vi.clearAllMocks()
    mockMatrixClient.getCrypto = vi.fn().mockReturnValue(mockCrypto)
    service = new MatrixEncryptionBootstrapService(mockMatrixClient)
  })

  describe('checkEncryptionSetup', () => {
    it('should return false when encryption is not set up', async () => {
      mockCrypto.isSecretStorageReady.mockResolvedValue(false)
      mockCrypto.isCrossSigningReady.mockResolvedValue(false)

      const needsSetup = await service.checkEncryptionSetup()

      expect(needsSetup).toBe(true)
    })

    it('should return true when encryption is already set up', async () => {
      mockCrypto.isSecretStorageReady.mockResolvedValue(true)
      mockCrypto.isCrossSigningReady.mockResolvedValue(true)

      const needsSetup = await service.checkEncryptionSetup()

      expect(needsSetup).toBe(false)
    })
  })

  describe('bootstrapEncryption', () => {
    it('should successfully bootstrap encryption with user passphrase', async () => {
      const testPassphrase = 'MySecurePassphrase123!'
      const mockRecoveryKey = new Uint8Array([1, 2, 3, 4])

      mockCrypto.createRecoveryKeyFromPassphrase.mockResolvedValue(mockRecoveryKey)
      mockCrypto.bootstrapCrossSigning.mockResolvedValue(undefined)
      mockCrypto.bootstrapSecretStorage.mockResolvedValue(undefined)

      const result = await service.bootstrapEncryption(testPassphrase)

      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
      expect(mockCrypto.createRecoveryKeyFromPassphrase).toHaveBeenCalledWith(testPassphrase)
      expect(mockCrypto.bootstrapCrossSigning).toHaveBeenCalled()
      expect(mockCrypto.bootstrapSecretStorage).toHaveBeenCalledWith({
        createSecretStorageKey: expect.any(Function)
      })
    })

    it('should handle cross-signing bootstrap failure', async () => {
      const testPassphrase = 'MySecurePassphrase123!'
      const error = new Error('Cross-signing setup failed')

      mockCrypto.createRecoveryKeyFromPassphrase.mockResolvedValue(new Uint8Array([1, 2, 3, 4]))
      mockCrypto.bootstrapCrossSigning.mockRejectedValue(error)

      const result = await service.bootstrapEncryption(testPassphrase)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Cross-signing setup failed')
      expect(result.step).toBe('cross-signing')
    })

    it('should handle secret storage bootstrap failure', async () => {
      const testPassphrase = 'MySecurePassphrase123!'
      const error = new Error('Secret storage setup failed')

      mockCrypto.createRecoveryKeyFromPassphrase.mockResolvedValue(new Uint8Array([1, 2, 3, 4]))
      mockCrypto.bootstrapCrossSigning.mockResolvedValue(undefined)
      mockCrypto.bootstrapSecretStorage.mockRejectedValue(error)

      const result = await service.bootstrapEncryption(testPassphrase)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Secret storage setup failed')
      expect(result.step).toBe('secret-storage')
    })

    it('should timeout after 30 seconds', async () => {
      const testPassphrase = 'MySecurePassphrase123!'

      // Mock a hanging promise
      mockCrypto.createRecoveryKeyFromPassphrase.mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 35000))
      )

      const result = await service.bootstrapEncryption(testPassphrase)

      expect(result.success).toBe(false)
      expect(result.error).toContain('timeout')
      expect(result.step).toBe('timeout')
    }, 35000) // Set test timeout to 35 seconds
  })

  describe('resetEncryption', () => {
    it('should successfully reset encryption (nuclear option)', async () => {
      mockCrypto.bootstrapCrossSigning.mockResolvedValue(undefined)
      mockCrypto.bootstrapSecretStorage.mockResolvedValue(undefined)

      const result = await service.resetEncryption()

      expect(result.success).toBe(true)
    })
  })

  describe('validatePassphrase', () => {
    it('should reject passphrases shorter than 12 characters', () => {
      const result = service.validatePassphrase('short')

      expect(result.isValid).toBe(false)
      expect(result.strength).toBe('weak')
      expect(result.feedback).toContain('12 characters')
    })

    it('should accept strong passphrases', () => {
      const result = service.validatePassphrase('MyVerySecurePassphrase123!')

      expect(result.isValid).toBe(true)
      expect(result.strength).toBe('strong')
    })

    it('should provide feedback for medium strength passphrases', () => {
      const result = service.validatePassphrase('myphrasetest123')

      expect(result.isValid).toBe(true)
      expect(result.strength).toBe('medium')
      expect(result.feedback).toContain('uppercase')
    })
  })
})
