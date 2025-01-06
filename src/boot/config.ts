import { boot } from 'quasar/wrappers'
export default boot(async () => {
  try {
    const response = await fetch('/config.json')
    if (!response.ok) {
      throw new Error('Failed to load config')
    }
    window.APP_CONFIG = await response.json()
  } catch (error) {
    console.error('Failed to load configuration:', error)
    // Fallback values
    window.APP_CONFIG = {
      APP_TENANT_DESCRIPTION: 'Building communities',
      APP_TENANT_NAME: 'OpenMeet',
      APP_TENANT_IMAGE: '/openmeet/openmeet-logo.png',
      APP_API_URL: process.env.APP_API_URL as string
    }
  }
})
