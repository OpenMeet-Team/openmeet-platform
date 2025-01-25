import { boot } from 'quasar/wrappers'
import { useConfigStore } from 'stores/config-store'

export default boot(async ({ store, ssrContext }) => {
  const configStore = useConfigStore(store)

  try {
    console.log('ssrContext', ssrContext)
    console.log('import.meta.env.SSR', import.meta.env.SSR)
    // In SSR mode, use a different config loading strategy
    if (import.meta.env.SSR) {
      // Load config from filesystem in SSR mode
      const fs = await import('fs')
      const path = await import('path')
      const configPath = path.resolve(process.cwd(), 'public/config.json')
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      console.log('config', config)
      await configStore.setConfig(config)
    } else {
      // Client-side config loading
      const response = await fetch('/config.json')
      const config = await response.json()
      await configStore.setConfig(config)
    }
  } catch (error) {
    console.error('Failed to load configuration:', error)
    throw error
  }
})
