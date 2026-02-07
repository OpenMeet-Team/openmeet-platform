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

  optOut () {
    if (posthog) {
      posthog.opt_out_capturing()
    }
  }

  optIn () {
    if (posthog) {
      posthog.opt_in_capturing()
    }
  }

  hasOptedOut (): boolean {
    if (posthog) {
      return posthog.has_opted_out_capturing()
    }
    return false
  }

  syncWithPreference (optOut: boolean | undefined) {
    if (optOut === true) {
      this.optOut()
    } else if (optOut === false) {
      this.optIn()
    }
  }
}

export default new AnalyticsService()
