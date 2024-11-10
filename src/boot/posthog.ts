import { PostHog } from 'posthog-js'
import { useAuthStore } from 'src/stores/auth-store'
import { Router } from 'vue-router'

let posthog: PostHog

// Check for the PostHog key before importing
const POSTHOG_KEY = process.env.APP_POSTHOG_KEY

if (POSTHOG_KEY) {
  import('posthog-js').then((module) => {
    posthog = module.default
    posthog.init(POSTHOG_KEY, {
      debug: false,
      api_host: 'https://us.i.posthog.com',
      person_profiles: 'identified_only'
    })
    posthog.group('tenant_id', process.env.APP_TENANT_ID)
  })
}

export default ({ router }: { router: Router }) => {
  if (posthog) {
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
