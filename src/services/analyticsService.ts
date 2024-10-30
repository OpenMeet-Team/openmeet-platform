import { PostHog } from 'posthog-js'
import { posthog } from 'src/boot/posthog'

class AnalyticsService {
  private posthog: PostHog

  constructor () {
    this.posthog = posthog
  }

  identify (userId: string, userProperties: object) {
    if (this.posthog) {
      this.posthog.identify(userId, userProperties)
    }
  }

  reset () {
    if (this.posthog) {
      this.posthog.reset()
    }
  }

  trackEvent (eventName: string, eventData?: object) {
    if (this.posthog) {
      this.posthog.capture(eventName, eventData)
    }
  }
}

export default new AnalyticsService()
