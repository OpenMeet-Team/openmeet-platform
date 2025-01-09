import { PostHog } from 'posthog-js'
import { useAuthStore } from 'src/stores/auth-store'
import { Router } from 'vue-router'

let posthog: PostHog

export default async ({ router }: { router: Router }) => {
  // Wait for config to be available
  while (!window.APP_CONFIG?.APP_POSTHOG_KEY) {
    await new Promise(resolve => setTimeout(resolve, 50))
  }

  const POSTHOG_KEY = window.APP_CONFIG.APP_POSTHOG_KEY

  if (POSTHOG_KEY) {
    const module = await import('posthog-js')
    posthog = module.default
    posthog.init(POSTHOG_KEY, {
      debug: false,
      api_host: 'https://us.i.posthog.com',
      person_profiles: 'identified_only'
    })
    posthog.group('tenant_id', window.APP_CONFIG.APP_TENANT_ID)

    const authStore = useAuthStore()
    if (authStore.getUser) {
      posthog.identify(authStore.getUser.shortId, {
        email: authStore.getUser.email,
        name: authStore.getUser.name
      })
    }

    router.afterEach((to) => {
      posthog.capture('$pageview', { path: to.path })
    })
  }
}

export { posthog }
