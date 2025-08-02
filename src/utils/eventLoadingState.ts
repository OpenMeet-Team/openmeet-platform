/**
 * Event loading state management
 * SECURITY: Module-scoped cache to replace window globals and prevent pollution
 */

// Track when events were last loaded to prevent redundant API calls
const lastEventPageLoad: Record<string, number> = {}

// Track when events were last checked for attendance to prevent redundant API calls
const lastEventAttendanceCheck: Record<string, number> = {}

// Track which event is currently being loaded to prevent race conditions
let eventBeingLoaded: string | null = null

export const eventLoadingState = {
  // Event page loading tracking
  getLastEventPageLoad (eventSlug: string): number {
    return lastEventPageLoad[eventSlug] || 0
  },

  setLastEventPageLoad (eventSlug: string, timestamp: number): void {
    lastEventPageLoad[eventSlug] = timestamp
  },

  // Event attendance checking tracking
  getLastEventAttendanceCheck (eventSlug: string): number {
    return lastEventAttendanceCheck[eventSlug] || 0
  },

  setLastEventAttendanceCheck (eventSlug: string, timestamp: number): void {
    lastEventAttendanceCheck[eventSlug] = timestamp
  },

  // Event loading state tracking
  getEventBeingLoaded (): string | null {
    return eventBeingLoaded
  },

  setEventBeingLoaded (eventSlug: string | null): void {
    eventBeingLoaded = eventSlug
  },

  isEventBeingLoaded (eventSlug: string): boolean {
    return eventBeingLoaded === eventSlug
  }
}
