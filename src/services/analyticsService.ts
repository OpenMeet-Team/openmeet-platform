import { posthog } from '../boot/posthog'

class AnalyticsService {
  identify (userId: string, userProperties: object) {
    console.log('Analytics identify called:', { userId, userProperties, posthogAvailable: !!posthog })
    if (posthog) {
      posthog.identify(userId, userProperties)
      console.log('PostHog identify executed successfully')
    } else {
      console.warn('PostHog not available for identify call')
    }
  }

  reset () {
    console.log('Analytics reset called, posthogAvailable:', !!posthog)
    if (posthog) {
      posthog.reset()
    }
  }

  trackEvent (eventName: string, eventData?: object) {
    console.log('Analytics trackEvent called:', { eventName, eventData, posthogAvailable: !!posthog })
    if (posthog) {
      posthog.capture(eventName, eventData)
    }
  }
}

export default new AnalyticsService()
