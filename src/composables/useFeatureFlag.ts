import { ref, onMounted, Ref } from 'vue'
import { posthog } from '../boot/posthog'

/**
 * Composable for checking PostHog feature flags
 * @param flagKey - The feature flag key in PostHog
 * @param defaultValue - Default value if flag is not set or PostHog is unavailable
 * @returns Reactive ref with the feature flag value
 */
export function useFeatureFlag (flagKey: string, defaultValue: boolean = false): Ref<boolean> {
  const isEnabled = ref(defaultValue)

  onMounted(() => {
    console.log(`[FeatureFlag] Checking flag: ${flagKey}`)
    console.log('[FeatureFlag] PostHog instance:', posthog)

    // Check if PostHog is available
    if (!posthog) {
      console.warn(`[FeatureFlag] PostHog not available. Using default value for feature flag: ${flagKey}`)
      isEnabled.value = defaultValue
      return
    }

    // Get initial flag value
    const flagValue = posthog.isFeatureEnabled(flagKey)
    console.log(`[FeatureFlag] Initial value for ${flagKey}:`, flagValue)
    isEnabled.value = flagValue !== undefined ? flagValue : defaultValue

    // Listen for flag changes
    posthog.onFeatureFlags(() => {
      const updatedValue = posthog.isFeatureEnabled(flagKey)
      console.log(`[FeatureFlag] Updated value for ${flagKey}:`, updatedValue)
      isEnabled.value = updatedValue !== undefined ? updatedValue : defaultValue
    })
  })

  return isEnabled
}

/**
 * Convenience composable for the activity feed feature flag
 * @returns Reactive ref indicating if activity feed should be shown
 */
export function useShowActivityFeed (): Ref<boolean> {
  return useFeatureFlag('show-activity-feed', false)
}
