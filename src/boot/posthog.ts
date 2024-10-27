import { PostHog } from 'posthog-js'
import { Router } from 'vue-router'

let posthog: PostHog

// Check for the PostHog key before importing
const POSTHOG_KEY = process.env.APP_POSTHOG_KEY || window.APP_CONFIG?.APP_POSTHOG_KEY

if (POSTHOG_KEY) {
  import('posthog-js').then((module) => {
    posthog = module.default
    posthog.init(POSTHOG_KEY, {
      api_host: 'https://us.i.posthog.com',
      person_profiles: 'identified_only' // Set to 'always' if anonymous profiles are needed
    })
  })
}

export default ({ router }: { router: Router }) => {
  if (posthog) {
    router.afterEach((to) => {
      posthog.capture('$pageview', { path: to.path })
    })
  }
}

export { posthog }
