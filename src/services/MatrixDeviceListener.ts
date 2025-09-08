/**
 * Matrix Device Listener Service - Following Element Web patterns
 *
 * Monitors device verification status and handles room key sharing prerequisites.
 * Based on Element Web's DeviceListener.ts implementation.
 */

import { type MatrixClient } from 'matrix-js-sdk'
import { CryptoEvent } from 'matrix-js-sdk/lib/crypto-api'
import { logger } from '../utils/logger'

export interface DeviceVerificationStatus {
  deviceId: string
  userId: string
  isVerified: boolean
  crossSigningVerified: boolean
  signedByOwner: boolean
  needsVerification: boolean
}

export class MatrixDeviceListener {
  private client: MatrixClient | null = null
  private isListening = false
  private dismissedDevices = new Set<string>()

  constructor () {
    logger.debug('🔐 MatrixDeviceListener created')
  }

  /**
   * Start monitoring device verification status
   */
  public start (client: MatrixClient): void {
    if (this.isListening || !client) {
      return
    }

    this.client = client
    this.isListening = true

    // Set up crypto event listeners following Element Web pattern
    this.setupCryptoEventListeners()

    logger.debug('✅ MatrixDeviceListener started and monitoring device verification')
  }

  /**
   * Stop monitoring device verification
   */
  public stop (): void {
    if (!this.isListening || !this.client) {
      return
    }

    this.removeCryptoEventListeners()
    this.client = null
    this.isListening = false
    this.dismissedDevices.clear()

    logger.debug('🔐 MatrixDeviceListener stopped')
  }

  /**
   * Setup crypto event listeners following Element Web patterns
   */
  private setupCryptoEventListeners (): void {
    if (!this.client) return

    // Listen for device updates - new devices joining rooms
    this.client.on(CryptoEvent.DevicesUpdated, this.onDevicesUpdated)

    // Listen for cross-signing key changes
    this.client.on(CryptoEvent.KeysChanged, this.onKeysChanged)

    // Listen for user trust status changes
    this.client.on(CryptoEvent.UserTrustStatusChanged, this.onUserTrustStatusChanged)

    logger.debug('🔐 Crypto event listeners attached for device verification')
  }

  /**
   * Remove crypto event listeners
   */
  private removeCryptoEventListeners (): void {
    if (!this.client) return

    this.client.off(CryptoEvent.DevicesUpdated, this.onDevicesUpdated)
    this.client.off(CryptoEvent.KeysChanged, this.onKeysChanged)
    this.client.off(CryptoEvent.UserTrustStatusChanged, this.onUserTrustStatusChanged)

    logger.debug('🔐 Crypto event listeners removed')
  }

  /**
   * Handle device updates - new devices that may need verification
   */
  private onDevicesUpdated = async (userIds: string[], initialFetch?: boolean): Promise<void> => {
    logger.debug('🔍 Devices updated for users:', { userIds, initialFetch })

    if (!this.client || !this.client.getCrypto()) {
      return
    }

    const crypto = this.client.getCrypto()!

    try {
      // Check verification status for updated devices
      for (const userId of userIds) {
        const devices = await crypto.getUserDeviceInfo([userId])
        const userDevices = devices.get(userId)

        if (userDevices) {
          for (const [deviceId, deviceInfo] of Array.from(userDevices)) {
            const verificationStatus = await this.getDeviceVerificationStatus(userId, deviceId)

            if (verificationStatus.needsVerification && !this.dismissedDevices.has(deviceId)) {
              logger.warn('⚠️ Unverified device detected:', {
                userId,
                deviceId,
                deviceName: deviceInfo.displayName,
                verificationStatus
              })

              // In a full implementation, this would trigger UI notifications
              // For now, we log the need for verification
              await this.handleUnverifiedDevice(verificationStatus)
            }
          }
        }
      }
    } catch (error) {
      logger.error('❌ Error processing device updates:', error)
    }
  }

  /**
   * Handle cross-signing key changes
   */
  private onKeysChanged = (): void => {
    logger.debug('🔑 Cross-signing keys changed')

    // Key changes may affect room key sharing - refresh device verification status
    this.refreshDeviceVerificationStatus()
  }

  /**
   * Handle user trust status changes
   */
  private onUserTrustStatusChanged = (userId: string, verificationStatus: unknown): void => {
    logger.debug('👤 User trust status changed:', { userId, verificationStatus })

    // Trust status changes may affect room key sharing
    this.refreshDeviceVerificationStatus()
  }

  /**
   * Get comprehensive device verification status
   */
  public async getDeviceVerificationStatus (userId: string, deviceId: string): Promise<DeviceVerificationStatus> {
    if (!this.client || !this.client.getCrypto()) {
      throw new Error('Matrix client or crypto not available')
    }

    const crypto = this.client.getCrypto()!

    try {
      const verificationStatus = await crypto.getDeviceVerificationStatus(userId, deviceId)

      const status: DeviceVerificationStatus = {
        deviceId,
        userId,
        isVerified: verificationStatus?.isVerified() ?? false,
        crossSigningVerified: verificationStatus?.crossSigningVerified ?? false,
        signedByOwner: verificationStatus?.signedByOwner ?? false,
        needsVerification: false
      }

      // Determine if verification is needed following Element Web logic
      status.needsVerification = !status.isVerified || !status.crossSigningVerified

      return status
    } catch (error) {
      logger.error('❌ Error getting device verification status:', { userId, deviceId, error })

      return {
        deviceId,
        userId,
        isVerified: false,
        crossSigningVerified: false,
        signedByOwner: false,
        needsVerification: true
      }
    }
  }

  /**
   * Handle unverified device detection
   */
  private async handleUnverifiedDevice (verificationStatus: DeviceVerificationStatus): Promise<void> {
    const { userId } = verificationStatus

    // Check if this is the current user's device
    const currentUserId = this.client?.getSafeUserId()
    const isOwnDevice = userId === currentUserId

    if (isOwnDevice) {
      logger.warn('🔐 Own unverified device detected - this will limit room key access:', verificationStatus)

      // For own devices, we should prompt for verification
      // This is where Element Web shows verification toasts
      await this.promptForDeviceVerification(verificationStatus)
    } else {
      logger.debug('👤 Other user has unverified device - may affect message decryption:', verificationStatus)

      // For other users' devices, we log but don't actively prompt
      // Room keys won't be shared until devices are verified
    }
  }

  /**
   * Prompt for device verification (Element Web pattern)
   */
  private async promptForDeviceVerification (verificationStatus: DeviceVerificationStatus): Promise<void> {
    const { userId, deviceId } = verificationStatus

    logger.info('🔐 Device verification needed:', {
      userId,
      deviceId,
      action: 'verification_required'
    })

    // In Element Web, this would show a toast/modal for verification
    // For OpenMeet, we could emit an event or update a reactive state
    // that components can listen to for showing verification UI

    // For now, we mark as dismissed to avoid spam
    this.dismissedDevices.add(deviceId)
  }

  /**
   * Refresh device verification status for all known devices
   */
  private async refreshDeviceVerificationStatus (): Promise<void> {
    if (!this.client || !this.client.getCrypto()) {
      return
    }

    logger.debug('🔄 Refreshing device verification status after key changes')

    try {
      // This would typically check all known devices and update their status
      // For performance, we could limit this to devices in current rooms
      const crypto = this.client.getCrypto()!

      // Get all known users (could be optimized to current room members)
      const currentUserId = this.client.getSafeUserId()
      if (currentUserId) {
        const devices = await crypto.getUserDeviceInfo([currentUserId])
        const userDevices = devices.get(currentUserId)

        if (userDevices) {
          for (const deviceId of Array.from(userDevices.keys())) {
            const status = await this.getDeviceVerificationStatus(currentUserId, deviceId)
            logger.debug('🔍 Device status after refresh:', status)
          }
        }
      }
    } catch (error) {
      logger.error('❌ Error refreshing device verification status:', error)
    }
  }

  /**
   * Check if room key sharing should be allowed for a device
   */
  public async shouldShareRoomKeys (userId: string, deviceId: string): Promise<boolean> {
    // TEMPORARY: Allow room key sharing with all devices to match AllDevicesIsolationMode(false) policy
    // This fixes asymmetric decryption issues while we work on proper device verification
    // TODO: Switch back to verification-based sharing when device verification is fully working

    const status = await this.getDeviceVerificationStatus(userId, deviceId)

    // For now, share keys with all devices to prevent asymmetric decryption failures
    const shouldShare = true

    logger.debug('🔑 Room key sharing decision (permissive mode):', {
      userId,
      deviceId,
      shouldShare: true,
      verificationStatus: status,
      note: 'Sharing with all devices until verification is fixed'
    })

    return shouldShare
  }

  /**
   * Dismiss verification prompt for a device
   */
  public dismissDevice (deviceId: string): void {
    this.dismissedDevices.add(deviceId)
    logger.debug('🔐 Device verification dismissed:', { deviceId })
  }

  /**
   * Get current verification status summary
   */
  public async getVerificationSummary (): Promise<{ verified: number; unverified: number; total: number }> {
    if (!this.client || !this.client.getCrypto()) {
      return { verified: 0, unverified: 0, total: 0 }
    }

    const crypto = this.client.getCrypto()!
    const currentUserId = this.client.getSafeUserId()

    if (!currentUserId) {
      return { verified: 0, unverified: 0, total: 0 }
    }

    try {
      const devices = await crypto.getUserDeviceInfo([currentUserId])
      const userDevices = devices.get(currentUserId)

      if (!userDevices) {
        return { verified: 0, unverified: 0, total: 0 }
      }

      let verified = 0
      let unverified = 0
      const total = userDevices.size

      for (const deviceId of userDevices.keys()) {
        const status = await this.getDeviceVerificationStatus(currentUserId, deviceId)
        if (status.isVerified && status.crossSigningVerified) {
          verified++
        } else {
          unverified++
        }
      }

      return { verified, unverified, total }
    } catch (error) {
      logger.error('❌ Error getting verification summary:', error)
      return { verified: 0, unverified: 0, total: 0 }
    }
  }
}

// Singleton instance
export const matrixDeviceListener = new MatrixDeviceListener()
