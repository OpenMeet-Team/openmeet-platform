import { boot } from 'quasar/wrappers'

/**
 * Add noindex meta tag to prevent search engine indexing.
 * Used for dev/staging environments.
 */
function addNoindexMeta () {
  const meta = document.createElement('meta')
  meta.name = 'robots'
  meta.content = 'noindex, nofollow'
  document.head.appendChild(meta)
}

export default boot(async () => {
  try {
    const response = await fetch('/config.json')
    if (!response.ok) {
      throw new Error('Failed to load config')
    }
    window.APP_CONFIG = await response.json()

    // Block search engine indexing unless explicitly allowed.
    // Prod should set APP_NOINDEX: false in config.json to allow indexing.
    if (window.APP_CONFIG?.APP_NOINDEX !== false) {
      addNoindexMeta()
    }

    // Store tenant ID in localStorage for WebSocket connections
    if (window.APP_CONFIG?.APP_TENANT_ID) {
      localStorage.setItem('tenantId', window.APP_CONFIG.APP_TENANT_ID)
      console.log('Stored tenant ID in localStorage:', window.APP_CONFIG.APP_TENANT_ID)
    } else {
      console.warn('No tenant ID in config.json')

      // Try to use cached tenant ID if it exists
      const cachedTenantId = localStorage.getItem('tenantId')
      if (cachedTenantId) {
        console.log('Using cached tenant ID from localStorage:', cachedTenantId)
        window.APP_CONFIG = window.APP_CONFIG || {}
        window.APP_CONFIG.APP_TENANT_ID = cachedTenantId
      }
    }
  } catch (error) {
    console.error('Failed to load configuration:', error)

    // Block indexing when config fails to load (fail-safe)
    addNoindexMeta()

    // Fallback values
    window.APP_CONFIG = {
      APP_TENANT_DESCRIPTION: 'Building communities',
      APP_TENANT_NAME: 'OpenMeet',
      APP_TENANT_IMAGE: '/openmeet/openmeet-logo.png',
      APP_API_URL: process.env.APP_API_URL as string
    }

    // Try to use cached tenant ID even if config loading failed
    const cachedTenantId = localStorage.getItem('tenantId')
    if (cachedTenantId) {
      console.log('Using cached tenant ID after config load failure:', cachedTenantId)
      window.APP_CONFIG.APP_TENANT_ID = cachedTenantId
    }
  }
})
