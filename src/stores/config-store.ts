import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Config {
  apiUrl: string
  tenant: {
    name: string
    description: string
    image: string
  }
  // Add other config properties as needed
}

export const useConfigStore = defineStore('config', () => {
  const config = ref<Config | null>(null)
  const isLoaded = ref(false)

  async function setConfig (newConfig: Config) {
    config.value = newConfig
    isLoaded.value = true
  }

  return {
    config,
    isLoaded,
    setConfig
  }
})
