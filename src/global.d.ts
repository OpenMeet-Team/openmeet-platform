declare global {
  interface Window {
    APP_CONFIG?: Record<string, string>
    // Track if an event page is being loaded to prevent duplicate API calls
    eventBeingLoaded?: string | null
    // Already exists in components but needs declaration
    lastEventPageLoad?: Record<string, number>
  }
}

export { }
