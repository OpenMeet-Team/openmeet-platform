/**
 * Matrix Device Debug Console Helper
 * 
 * Provides console commands for debugging Matrix device verification
 * Call `window.matrixDebug.status()` in browser console
 */

import { matrixClientService } from '../services/matrixClientService'
import { MatrixDeviceVerificationDebugService } from '../services/MatrixDeviceVerificationDebugService'
import { logger } from './logger'

class MatrixDeviceDebugConsole {
  private debugService: MatrixDeviceVerificationDebugService | null = null

  private getDebugService (): MatrixDeviceVerificationDebugService | null {
    const client = matrixClientService.getClient()
    if (!client) {
      console.log('❌ No Matrix client available')
      return null
    }

    if (!this.debugService) {
      this.debugService = new MatrixDeviceVerificationDebugService(client)
    }
    return this.debugService
  }

  /**
   * Get device verification status
   */
  async status () {
    console.log('🔍 Checking Matrix device verification status...')
    
    const debugService = this.getDebugService()
    if (!debugService) return

    try {
      const status = await debugService.getDeviceVerificationStatus()
      
      console.log('\n📱 Current Device:')
      console.log(`  User ID: ${status.currentDevice.userId}`)
      console.log(`  Device ID: ${status.currentDevice.deviceId}`)
      console.log(`  Is Verified: ${status.currentDevice.isVerified ? '✅' : '❌'}`)
      console.log(`  Cross-signing Ready: ${status.currentDevice.crossSigningReady ? '✅' : '❌'}`)
      console.log(`  Secret Storage Ready: ${status.currentDevice.secretStorageReady ? '✅' : '❌'}`)
      
      console.log('\n🔐 Cross-signing Status:')
      console.log(`  Ready: ${status.crossSigningStatus.ready ? '✅' : '❌'}`)
      console.log(`  Master Key: ${status.crossSigningStatus.keys.master ? '✅' : '❌'}`)
      
      console.log('\n📋 All Devices:')
      status.allDevices.forEach(device => {
        const currentMarker = device.deviceId === status.currentDevice.deviceId ? ' (current)' : ''
        console.log(`  ${device.deviceId}${currentMarker}: ${device.verified ? '✅' : '❌'} ${device.displayName}`)
      })

      if (!status.currentDevice.isVerified) {
        console.log('\n💡 To manually verify this device, run: window.matrixDebug.verify()')
      }

      return status
    } catch (error) {
      console.error('❌ Failed to get status:', error)
      logger.error('Failed to get verification status:', error)
    }
  }

  /**
   * Manually verify current device
   */
  async verify () {
    console.log('🔐 Attempting to manually verify current device...')
    
    const debugService = this.getDebugService()
    if (!debugService) return

    try {
      const result = await debugService.manuallyVerifyCurrentDevice()
      
      if (result.success) {
        console.log('✅ Device verification successful!')
        console.log(`   ${result.message}`)
      } else {
        console.log('❌ Device verification failed')
        console.log(`   ${result.message}`)
        console.log('\n💡 You might need to run: window.matrixDebug.reset()')
      }

      // Show updated status
      console.log('\n📊 Updated Status:')
      await this.status()

      return result
    } catch (error) {
      console.error('❌ Verification failed:', error)
      logger.error('Manual verification failed:', error)
    }
  }

  /**
   * Reset and re-bootstrap encryption (use with caution)
   */
  async reset () {
    const confirmed = confirm('⚠️ This will reset your encryption setup. Are you sure?')
    if (!confirmed) {
      console.log('❌ Reset cancelled')
      return
    }

    console.log('🔄 Resetting and re-bootstrapping encryption...')
    
    const debugService = this.getDebugService()
    if (!debugService) return

    try {
      const result = await debugService.resetAndRebootstrapEncryption()
      
      if (result.success) {
        console.log('✅ Encryption reset and re-bootstrap successful!')
        console.log(`   ${result.message}`)
      } else {
        console.log('❌ Reset failed')
        console.log(`   ${result.message}`)
      }

      // Show updated status
      console.log('\n📊 Status after reset:')
      await this.status()

      return result
    } catch (error) {
      console.error('❌ Reset failed:', error)
      logger.error('Reset failed:', error)
    }
  }

  /**
   * Show help
   */
  help () {
    console.log(`
🛠️ Matrix Device Debug Console Commands:

  window.matrixDebug.status()  - Show device verification status
  window.matrixDebug.verify()  - Manually verify current device  
  window.matrixDebug.reset()   - Reset and re-bootstrap encryption (⚠️ use with caution)
  window.matrixDebug.help()    - Show this help

📱 Current device ID: ${matrixClientService.getClient()?.getDeviceId() || 'Not available'}
👤 Current user ID: ${matrixClientService.getClient()?.getUserId() || 'Not available'}
`)
  }
}

// Create global instance
const matrixDeviceDebugConsole = new MatrixDeviceDebugConsole()

// Expose to window for console access
declare global {
  interface Window {
    matrixDebug: MatrixDeviceDebugConsole
  }
}

// Only expose in development/debug mode
if (process.env.NODE_ENV !== 'production' || window.location.hostname.includes('localhost')) {
  window.matrixDebug = matrixDeviceDebugConsole
  console.log('🛠️ Matrix Debug Console loaded. Type window.matrixDebug.help() for commands')
}

export { matrixDeviceDebugConsole }