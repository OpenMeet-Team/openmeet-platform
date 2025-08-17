/**
 * Matrix Device Manager
 *
 * Handles device verification, trust management, and multi-device coordination
 * for OpenMeet's security-focused approach
 */

import type { MatrixClient } from 'matrix-js-sdk'
import { logger } from '../utils/logger'

// Extended device info interface to handle Matrix SDK's incomplete types
interface ExtendedDeviceInfo {
  displayName?: string
  verified: boolean | object
  lastSeenTs?: number
}

export interface DeviceInfo {
  deviceId: string
  displayName: string
  isVerified: boolean
  isCurrentDevice: boolean
  isTrusted: boolean
  isOpenMeetClient: boolean
  lastSeen: number
  verificationMethod?: string
}

export interface DeviceVerificationRequest {
  deviceId: string
  verificationMethod: 'qr-code' | 'emoji-verification' | 'security-key'
  requestId: string
}

export class MatrixDeviceManager {
  private matrixClient: MatrixClient

  constructor (matrixClient: MatrixClient) {
    this.matrixClient = matrixClient
  }

  /**
   * Get all devices for the current user with OpenMeet-specific metadata
   */
  async getUserDevices (): Promise<DeviceInfo[]> {
    try {
      const userId = this.matrixClient.getUserId()
      const currentDeviceId = this.matrixClient.getDeviceId()

      if (!userId) {
        throw new Error('No user ID available')
      }

      const crypto = this.matrixClient.getCrypto()
      if (!crypto) {
        throw new Error('Crypto not available')
      }

      // Get device info from Matrix
      const devices = await crypto.getUserDeviceInfo([userId])
      const userDevices = devices.get(userId)

      if (!userDevices) {
        return []
      }

      const deviceList: DeviceInfo[] = []

      for (const [deviceId, deviceInfo] of userDevices) {
        const isCurrentDevice = deviceId === currentDeviceId
        const isTrusted = await this.isDeviceTrusted(deviceId)
        const isOpenMeetClient = await this.detectOpenMeetClient(deviceId, deviceInfo.displayName)

        // Type assertion for Matrix SDK's incomplete device info types
        const extendedDeviceInfo = deviceInfo as unknown as ExtendedDeviceInfo

        deviceList.push({
          deviceId,
          displayName: extendedDeviceInfo.displayName || 'Unknown Device',
          isVerified: !!extendedDeviceInfo.verified,
          isCurrentDevice,
          isTrusted,
          isOpenMeetClient,
          lastSeen: extendedDeviceInfo.lastSeenTs || 0,
          verificationMethod: await this.getVerificationMethod(deviceId)
        })
      }

      // Sort: current device first, then by last seen
      return deviceList.sort((a, b) => {
        if (a.isCurrentDevice) return -1
        if (b.isCurrentDevice) return 1
        return b.lastSeen - a.lastSeen
      })
    } catch (error) {
      logger.error('Failed to get user devices:', error)
      return []
    }
  }

  /**
   * Verify a device using the most appropriate method
   */
  async verifyDevice (deviceId: string, method: 'auto' | 'interactive' = 'auto'): Promise<boolean> {
    try {
      const userId = this.matrixClient.getUserId()
      const crypto = this.matrixClient.getCrypto()

      if (!userId || !crypto) {
        throw new Error('Missing user ID or crypto')
      }

      if (method === 'auto') {
        // Try auto-verification for first OpenMeet device
        const isFirstDevice = await this.isFirstOpenMeetDevice()
        if (isFirstDevice) {
          await crypto.setDeviceVerified(userId, deviceId, true)
          await this.recordDeviceVerification(deviceId, 'auto-first-device')
          logger.debug('✅ Device auto-verified as first OpenMeet device')
          return true
        }
      }

      // Fall back to interactive verification
      logger.debug('🔐 Starting interactive device verification for:', deviceId)
      // TODO: Implement interactive verification UI
      return false
    } catch (error) {
      logger.error('Failed to verify device:', error)
      return false
    }
  }

  /**
   * Revoke trust for a device
   */
  async revokeDeviceTrust (deviceId: string): Promise<boolean> {
    try {
      const userId = this.matrixClient.getUserId()
      const crypto = this.matrixClient.getCrypto()

      if (!userId || !crypto) {
        throw new Error('Missing user ID or crypto')
      }

      // Unverify the device
      await crypto.setDeviceVerified(userId, deviceId, false)

      // Remove from local trust store
      await this.removeDeviceFromTrustStore(deviceId)

      logger.debug('✅ Device trust revoked:', deviceId)
      return true
    } catch (error) {
      logger.error('Failed to revoke device trust:', error)
      return false
    }
  }

  /**
   * Check if device is trusted (local OpenMeet tracking)
   */
  private async isDeviceTrusted (deviceId: string): Promise<boolean> {
    try {
      const trustedDevices = JSON.parse(localStorage.getItem('openmeet_trusted_devices') || '{}')
      return !!trustedDevices[deviceId]
    } catch (error) {
      return false
    }
  }

  /**
   * Detect if device is an OpenMeet client
   */
  private async detectOpenMeetClient (deviceId: string, displayName?: string): Promise<boolean> {
    try {
      // Check display name patterns
      if (displayName) {
        const openMeetPatterns = [
          /openmeet/i,
          /om-platform/i,
          /element.*openmeet/i
        ]

        if (openMeetPatterns.some(pattern => pattern.test(displayName))) {
          return true
        }
      }

      // Check if it's the current device (we know we're OpenMeet)
      const currentDeviceId = this.matrixClient.getDeviceId()
      if (deviceId === currentDeviceId) {
        const isWebApp = window.location.hostname.includes('openmeet')
        return isWebApp
      }

      return false
    } catch (error) {
      return false
    }
  }

  /**
   * Check if this is the first OpenMeet device
   */
  private async isFirstOpenMeetDevice (): Promise<boolean> {
    try {
      const devices = await this.getUserDevices()
      const openMeetDevices = devices.filter(d => d.isOpenMeetClient && d.isVerified)

      // If no other OpenMeet devices are verified, this is the first
      return openMeetDevices.length === 0
    } catch (error) {
      return false
    }
  }

  /**
   * Record device verification in local storage
   */
  private async recordDeviceVerification (deviceId: string, method: string): Promise<void> {
    try {
      const trustedDevices = JSON.parse(localStorage.getItem('openmeet_trusted_devices') || '{}')
      trustedDevices[deviceId] = {
        trustedAt: Date.now(),
        verificationMethod: method,
        version: '1.0'
      }
      localStorage.setItem('openmeet_trusted_devices', JSON.stringify(trustedDevices))
    } catch (error) {
      logger.debug('Could not record device verification:', error)
    }
  }

  /**
   * Get verification method for device
   */
  private async getVerificationMethod (deviceId: string): Promise<string | undefined> {
    try {
      const trustedDevices = JSON.parse(localStorage.getItem('openmeet_trusted_devices') || '{}')
      return trustedDevices[deviceId]?.verificationMethod
    } catch (error) {
      return undefined
    }
  }

  /**
   * Remove device from trust store
   */
  private async removeDeviceFromTrustStore (deviceId: string): Promise<void> {
    try {
      const trustedDevices = JSON.parse(localStorage.getItem('openmeet_trusted_devices') || '{}')
      delete trustedDevices[deviceId]
      localStorage.setItem('openmeet_trusted_devices', JSON.stringify(trustedDevices))
    } catch (error) {
      logger.debug('Could not remove device from trust store:', error)
    }
  }
}
