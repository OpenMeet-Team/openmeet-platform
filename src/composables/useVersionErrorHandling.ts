import { ref } from 'vue'
import { Notify } from 'quasar'
import { versionService } from '../services/versionService'
const hasShownVersionError = ref(false)

export function useVersionErrorHandling () {
  const handlePotentialVersionError = (error: unknown) => {
    if (hasShownVersionError.value) {
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const errorObj = error as any
    const isLikelyVersionMismatch =
      errorObj?.response?.status === 404 ||
      errorObj?.response?.status === 422 ||
      errorObj?.message?.includes('chunk') ||
      errorObj?.message?.includes('Loading chunk') ||
      errorObj?.message?.includes('Loading CSS chunk') ||
      errorObj?.message?.includes('Failed to fetch') ||
      errorObj?.name === 'ChunkLoadError'

    if (isLikelyVersionMismatch && versionService.isUpdateAvailable.value) {
      hasShownVersionError.value = true

      Notify.create({
        type: 'warning',
        message: 'This issue may be resolved by updating to the latest version',
        actions: [
          {
            label: 'Update Now',
            color: 'white',
            handler: () => {
              versionService.forceReload()
            }
          },
          {
            label: 'Dismiss',
            color: 'white',
            handler: () => {
              setTimeout(() => {
                hasShownVersionError.value = false
              }, 5 * 60 * 1000)
            }
          }
        ],
        timeout: 0,
        position: 'top'
      })
    }
  }

  const resetVersionErrorShown = () => {
    hasShownVersionError.value = false
  }

  return {
    handlePotentialVersionError,
    resetVersionErrorShown
  }
}

export function setupGlobalErrorHandling () {
  window.addEventListener('error', (event) => {
    const { handlePotentialVersionError } = useVersionErrorHandling()
    handlePotentialVersionError(event.error)
  })

  window.addEventListener('unhandledrejection', (event) => {
    const { handlePotentialVersionError } = useVersionErrorHandling()
    handlePotentialVersionError(event.reason)
  })
}
