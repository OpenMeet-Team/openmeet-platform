/**
 * Matrix Reset Helper
 *
 * Simple utility functions for consistent Matrix reset behavior across the application
 */

import type { MatrixClient } from 'matrix-js-sdk'
import { MatrixResetService, type ResetOptions } from '../services/MatrixResetService'
import { logger } from './logger'

/**
 * Show a user-friendly reset dialog and perform the reset
 */
export async function showResetDialog (matrixClient: MatrixClient, currentContext: 'chat' | 'profile' | 'general' = 'general'): Promise<{
  success: boolean
  error?: string
  recoveryKey?: string
}> {
  try {
    const { Dialog, Notify } = await import('quasar')

    // Get reset recommendations
    const resetService = new MatrixResetService(matrixClient)
    const instructions = await resetService.getResetInstructions()

    // Show reset options dialog
    const resetType = await new Promise<string | null>((resolve) => {
      Dialog.create({
        title: 'Reset Matrix Encryption',
        message: `${instructions.instructions}\n\n${instructions.warning || ''}`,
        options: {
          type: 'radio',
          model: instructions.recommendedAction,
          items: [
            {
              label: 'Forgot recovery key (generate new one)',
              value: 'forgot_recovery_key',
              caption: 'Best for when you lost your recovery key'
            },
            {
              label: 'Fix unlock issues (light reset)',
              value: 'unlock_failed',
              caption: 'Preserves connection, resets encryption only'
            },
            {
              label: 'Fix verification issues (key mismatch)',
              value: 'key_mismatch',
              caption: 'Fixes device verification problems'
            },
            {
              label: 'Complete reset (nuclear option)',
              value: 'complete',
              caption: 'Reset everything - use as last resort'
            }
          ]
        },
        cancel: true,
        persistent: true,
        ok: {
          label: 'Reset Encryption',
          color: 'orange'
        }
      }).onOk((type: string) => resolve(type)).onCancel(() => resolve(null))
    })

    if (!resetType) {
      return { success: false, error: 'Reset cancelled by user' }
    }

    // Perform the reset
    const resetOptions: ResetOptions = {
      resetType: resetType as 'forgot_recovery_key' | 'unlock_failed' | 'key_mismatch' | 'complete',
      clearLocalData: resetType === 'complete',
      forceReconnection: resetType === 'complete'
    }

    const result = await resetService.performReset(resetOptions)

    if (result.success) {
      // Show success notification
      Notify.create({
        type: 'positive',
        message: 'Encryption reset completed successfully!',
        timeout: 3000,
        actions: result.recoveryKey ? [
          {
            label: 'View Recovery Key',
            color: 'white',
            handler: () => showRecoveryKeyDialog(result.recoveryKey!)
          }
        ] : undefined
      })

      // Emit global event for UI updates
      window.dispatchEvent(new CustomEvent('matrix-reset-completed', {
        detail: {
          resetType,
          context: currentContext,
          recoveryKey: result.recoveryKey,
          timestamp: Date.now()
        }
      }))

      return result
    } else {
      Notify.create({
        type: 'negative',
        message: `Reset failed: ${result.error}`,
        timeout: 5000
      })

      return result
    }
  } catch (error) {
    logger.error('Reset dialog error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Show recovery key dialog
 */
export async function showRecoveryKeyDialog (recoveryKey: string): Promise<void> {
  try {
    const { Dialog } = await import('quasar')

    Dialog.create({
      title: 'Save Your Recovery Key',
      message: `
        <div style="margin-bottom: 16px;">
          <strong>IMPORTANT:</strong> Save this recovery key in a secure location. 
          You will need it to access your encrypted messages if you lose access to this device.
        </div>
        <div style="background: #f5f5f5; padding: 12px; border-radius: 4px; font-family: monospace; word-break: break-all; margin: 16px 0;">
          ${recoveryKey}
        </div>
        <div style="font-size: 14px; color: #666;">
          Tip: You can save this to a password manager or write it down and store it safely.
        </div>
      `,
      html: true,
      ok: {
        label: 'I have saved my recovery key',
        color: 'primary'
      },
      cancel: {
        label: 'Copy to clipboard',
        color: 'grey'
      },
      persistent: true
    }).onCancel(() => {
      // Copy to clipboard
      navigator.clipboard.writeText(recoveryKey).then(async () => {
        const { Notify } = await import('quasar')
        Notify.create({
          type: 'positive',
          message: 'Recovery key copied to clipboard',
          timeout: 2000
        })
      }).catch(async () => {
        const { Notify } = await import('quasar')
        Notify.create({
          type: 'negative',
          message: 'Failed to copy to clipboard',
          timeout: 2000
        })
      })
    })
  } catch (error) {
    logger.error('Recovery key dialog error:', error)
  }
}

/**
 * Quick reset for specific scenarios without showing dialog
 */
export async function quickReset (
  matrixClient: MatrixClient,
  resetType: ResetOptions['resetType'],
  showNotification: boolean = true
): Promise<{
  success: boolean
  error?: string
  recoveryKey?: string
}> {
  try {
    const resetService = new MatrixResetService(matrixClient)

    const resetOptions: ResetOptions = {
      resetType,
      clearLocalData: resetType === 'complete',
      forceReconnection: resetType === 'complete'
    }

    const result = await resetService.performReset(resetOptions)

    if (showNotification) {
      const { Notify } = await import('quasar')

      if (result.success) {
        Notify.create({
          type: 'positive',
          message: `${resetType.replace('_', ' ')} completed successfully!`,
          timeout: 3000
        })
      } else {
        Notify.create({
          type: 'negative',
          message: `Reset failed: ${result.error}`,
          timeout: 5000
        })
      }
    }

    return result
  } catch (error) {
    logger.error('Quick reset error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Check if a reset is recommended and show a non-intrusive suggestion
 */
export async function checkAndSuggestReset (matrixClient: MatrixClient): Promise<boolean> {
  try {
    const resetService = new MatrixResetService(matrixClient)
    const instructions = await resetService.getResetInstructions()

    if (instructions.recommendedAction !== 'unlock_failed') {
      const { Notify } = await import('quasar')

      Notify.create({
        type: 'info',
        message: `Encryption issue detected: ${instructions.instructions}`,
        timeout: 8000,
        actions: [
          {
            label: 'Fix Now',
            color: 'white',
            handler: () => showResetDialog(matrixClient)
          },
          {
            label: 'Dismiss',
            color: 'white'
          }
        ]
      })

      return true
    }

    return false
  } catch (error) {
    logger.debug('Reset check error (non-critical):', error)
    return false
  }
}

/**
 * Listen for reset completion events
 */
export function onResetCompleted (callback: (detail: {
  resetType: string
  context: string
  recoveryKey?: string
  timestamp: number
}) => void): () => void {
  const listener = (event: CustomEvent) => {
    callback(event.detail)
  }

  window.addEventListener('matrix-reset-completed', listener as (event: Event) => void)

  // Return cleanup function
  return () => {
    window.removeEventListener('matrix-reset-completed', listener as (event: Event) => void)
  }
}
