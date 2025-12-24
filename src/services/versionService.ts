import { ref, computed } from 'vue'
import { APP_VERSION, COMMIT_SHA } from '../version.js'

export interface VersionInfo {
  version: string
  commitSha: string
}

class VersionService {
  private currentVersion = APP_VERSION
  private currentCommitSha = COMMIT_SHA
  private deployedVersion = ref<string | null>(null)
  private deployedCommitSha = ref<string | null>(null)
  private lastCheckTime = ref<number>(0)
  private checkInterval: number | null = null
  private isChecking = ref(false)
  private updateDismissedUntil = ref<number>(0)

  public readonly isUpdateAvailable = computed(() => {
    if (!this.deployedVersion.value) return false
    return this.deployedVersion.value !== this.currentVersion ||
           (this.deployedCommitSha.value && this.deployedCommitSha.value !== this.currentCommitSha)
  })

  public readonly isUpdateDismissed = computed(() => {
    return Date.now() < this.updateDismissedUntil.value
  })

  public readonly shouldShowUpdatePrompt = computed(() => {
    return this.isUpdateAvailable.value && !this.isUpdateDismissed.value
  })

  public getCurrentVersion (): VersionInfo {
    return {
      version: this.currentVersion,
      commitSha: this.currentCommitSha
    }
  }

  public getDeployedVersion (): VersionInfo | null {
    if (!this.deployedVersion.value) return null
    return {
      version: this.deployedVersion.value,
      commitSha: this.deployedCommitSha.value || 'unknown'
    }
  }

  public async checkForUpdates (): Promise<boolean> {
    // Skip version checking in development mode
    if (import.meta.env.DEV) {
      return false
    }

    if (this.isChecking.value) {
      return this.isUpdateAvailable.value
    }

    this.isChecking.value = true

    try {
      const [versionResponse, commitResponse] = await Promise.all([
        fetch('/app-version.txt', {
          cache: 'no-cache',
          headers: { 'Cache-Control': 'no-cache' }
        }),
        fetch('/commit-sha.txt', {
          cache: 'no-cache',
          headers: { 'Cache-Control': 'no-cache' }
        })
      ])

      if (versionResponse.ok) {
        this.deployedVersion.value = (await versionResponse.text()).trim()
      }

      if (commitResponse.ok) {
        this.deployedCommitSha.value = (await commitResponse.text()).trim()
      }

      this.lastCheckTime.value = Date.now()

      console.log('Version check completed:', {
        current: { version: this.currentVersion, commit: this.currentCommitSha },
        deployed: { version: this.deployedVersion.value, commit: this.deployedCommitSha.value },
        updateAvailable: this.isUpdateAvailable.value
      })

      return this.isUpdateAvailable.value
    } catch (error) {
      console.error('Failed to check for updates:', error)
      return false
    } finally {
      this.isChecking.value = false
    }
  }

  public startPeriodicChecking (intervalMs: number = 10 * 60 * 1000): void {
    this.stopPeriodicChecking()

    this.checkInterval = window.setInterval(() => {
      if (!this.isUpdateDismissed.value) {
        this.checkForUpdates()
      }
    }, intervalMs)

    console.log(`Started periodic version checking every ${intervalMs / 1000} seconds`)
  }

  public stopPeriodicChecking (): void {
    if (this.checkInterval) {
      window.clearInterval(this.checkInterval)
      this.checkInterval = null
      console.log('Stopped periodic version checking')
    }
  }

  public dismissUpdatePrompt (durationMs: number = 30 * 60 * 1000): void {
    this.updateDismissedUntil.value = Date.now() + durationMs
    console.log(`Update prompt dismissed for ${durationMs / 1000} seconds`)
  }

  public forceReload (): void {
    console.log('Forcing app reload with cache busting')

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(registration => {
          console.log('Unregistering service worker:', registration.scope)
          registration.unregister()
        })
      }).catch(error => {
        console.warn('Failed to unregister service workers:', error)
      })
    }

    const currentUrl = new URL(window.location.href)
    currentUrl.searchParams.set('v', Date.now().toString())
    currentUrl.searchParams.set('cache-bust', 'true')

    window.location.href = currentUrl.toString()
  }

  public setupVisibilityChangeDetection (): void {
    const handleVisibilityChange = () => {
      if (!document.hidden && !this.isUpdateDismissed.value) {
        const timeSinceLastCheck = Date.now() - this.lastCheckTime.value
        if (timeSinceLastCheck > 5 * 60 * 1000) {
          this.checkForUpdates()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
  }

  public async initializeVersionChecking (): Promise<void> {
    // Skip version checking in development mode
    if (import.meta.env.DEV) {
      console.log('Version checking disabled in development mode')
      return
    }

    console.log('Initializing version checking service (production mode)')

    await this.checkForUpdates()

    this.startPeriodicChecking()

    this.setupVisibilityChangeDetection()

    console.log('Version checking service initialized')
  }

  public destroy (): void {
    this.stopPeriodicChecking()
    console.log('Version checking service destroyed')
  }
}

export const versionService = new VersionService()
export default versionService
