import { PostHog } from 'posthog-js'
import { Router } from 'vue-router'

let posthog: PostHog

export default async ({ router }: { router: Router }) => {
  // Wait for config to be available
  const waitForConfig = new Promise<string>((resolve) => {
    if (window.APP_CONFIG?.APP_POSTHOG_KEY) {
      resolve(window.APP_CONFIG.APP_POSTHOG_KEY)
      return
    }

    document.addEventListener('DOMContentLoaded', () => {
      resolve(window.APP_CONFIG?.APP_POSTHOG_KEY)
    })
  })

  const POSTHOG_KEY = await waitForConfig
  if (!POSTHOG_KEY) {
    console.warn('PostHog key not found. Analytics disabled.')
    return
  }

  const module = await import('posthog-js')
  posthog = module.default
  posthog.init(POSTHOG_KEY, {
    api_host: 'https://us.i.posthog.com'
  })

  router.afterEach((to) => {
    if (!to.path.includes('/auth/bluesky/callback')) {
      posthog?.capture('$pageview', { path: to.path })
    }
  })
}

export { posthog }
