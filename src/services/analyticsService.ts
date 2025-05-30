import { posthog } from '../boot/posthog'

class AnalyticsService {
  identify (userId: string, userProperties: object) {
    if (posthog) {
      posthog.identify(userId, userProperties)
    }
  }

  reset () {
    if (posthog) {
      posthog.reset()
    }
  }

  trackEvent (eventName: string, eventData?: object) {
    if (posthog) {
      posthog.capture(eventName, eventData)
    }
  }
}

export default new AnalyticsService()
