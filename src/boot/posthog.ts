import { posthog } from 'posthog-js'
import { Router } from 'vue-router'

export default async ({ router }: { router: Router }) => {
  // Wait for config to be available
  // const waitForConfig = new Promise<string>((resolve) => {
  //   if (window.APP_CONFIG?.APP_POSTHOG_KEY) {
  //     resolve(window.APP_CONFIG.APP_POSTHOG_KEY)
  //     return
  //   }

  //   document.addEventListener('DOMContentLoaded', () => {
  //     resolve(window.APP_CONFIG?.APP_POSTHOG_KEY)
  //   })
  // })

  // const POSTHOG_KEY = await waitForConfig
  const POSTHOG_KEY = process.env.APP_POSTHOG_KEY
  if (!POSTHOG_KEY) {
    console.warn('PostHog key not found. Analytics disabled.')
    return
  }

  // const module = await import('posthog-js')
  // posthog = module.default
  posthog.init(POSTHOG_KEY as string, {
    api_host: 'https://us.i.posthog.com'
  })

  router.afterEach((to) => {
    if (!to.path.includes('/auth/bluesky/callback')) {
      posthog?.capture('$pageview', { path: to.path })
    }
  })
}

export { posthog }
