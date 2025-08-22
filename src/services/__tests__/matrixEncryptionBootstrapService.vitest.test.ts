/**
 * TDD Tests for Matrix Encryption Bootstrap Service
 *
 * Test-first approach to implement encryption setup with user-chosen passphrase
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { MatrixClient } from 'matrix-js-sdk'
import { MatrixEncryptionService } from '../MatrixEncryptionService'

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

describe('MatrixEncryptionService', () => {
  let service: MatrixEncryptionService

  beforeEach(() => {
    vi.clearAllMocks()
    mockMatrixClient.getCrypto = vi.fn().mockReturnValue(mockCrypto)
    service = new MatrixEncryptionService(mockMatrixClient)
  })

  describe('getStatus', () => {
    it('should return needsSetup true when encryption is not set up', async () => {
      mockCrypto.isSecretStorageReady.mockResolvedValue(false)
      mockCrypto.isCrossSigningReady.mockResolvedValue(false)

      const status = await service.getStatus()

      expect(status.needsSetup).toBe(true)
      expect(status.isReady).toBe(false)
    })

    it('should return needsSetup false when encryption is already set up', async () => {
      mockCrypto.isSecretStorageReady.mockResolvedValue(true)
      mockCrypto.isCrossSigningReady.mockResolvedValue(true)

      const status = await service.getStatus()

      expect(status.needsSetup).toBe(false)
      expect(status.isReady).toBe(true)
    })
  })

  describe('setupEncryption', () => {
    it('should successfully set up encryption with user passphrase', async () => {
      const testPassphrase = 'MySecurePassphrase123!'

      mockCrypto.isSecretStorageReady.mockResolvedValue(false)
      mockCrypto.isCrossSigningReady.mockResolvedValue(false)
      mockCrypto.bootstrapCrossSigning.mockResolvedValue(undefined)
      mockCrypto.bootstrapSecretStorage.mockResolvedValue(undefined)

      const result = await service.setupEncryption(testPassphrase)

      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should handle encryption setup failure', async () => {
      const testPassphrase = 'MySecurePassphrase123!'
      const error = new Error('Setup failed')

      mockCrypto.isSecretStorageReady.mockResolvedValue(false)
      mockCrypto.bootstrapCrossSigning.mockRejectedValue(error)

      const result = await service.setupEncryption(testPassphrase)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Setup failed')
    })
  })

  describe('resetEncryption', () => {
    it('should successfully reset encryption (nuclear option)', async () => {
      mockCrypto.bootstrapCrossSigning.mockResolvedValue(undefined)
      mockCrypto.bootstrapSecretStorage.mockResolvedValue(undefined)

      const result = await service.resetEncryption()

      expect(result.success).toBe(true)
    })
  })
})
