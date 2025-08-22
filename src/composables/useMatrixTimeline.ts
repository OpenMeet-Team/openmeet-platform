/**
 * Matrix Timeline Composable - Following Matrix JS SDK best practices
 *
 * This composable provides timeline functionality using the Matrix JS SDK's
 * TimelineWindow class, following established patterns for reliable timeline management.
 */

import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import {
  TimelineWindow,
  EventTimeline,
  Direction,
  type MatrixEvent,
  type MatrixClient,
  type EventTimelineSet,
  MatrixEventEvent,
  RoomEvent
} from 'matrix-js-sdk'
import { logger } from '../utils/logger'

// Pagination configuration
const PAGINATION_SIZE = 50
const INITIAL_LOAD_SIZE = 30

interface TimelineOptions {
  timelineSet?: EventTimelineSet
  client?: MatrixClient
  eventId?: string
  windowLimit?: number
}

export function useMatrixTimeline (options: TimelineOptions = {}) {
  // Core timeline state
  const timelineWindow = ref<TimelineWindow | null>(null)
  const events = ref<MatrixEvent[]>([])
  const isLoading = ref(false)
  const canPaginateBack = ref(false)
  const canPaginateForward = ref(false)
  const isPaginatingBack = ref(false)
  const isPaginatingForward = ref(false)

  // Extract events from TimelineWindow and handle decryption - Element Web pattern
  const refreshEvents = (): void => {
    if (!timelineWindow.value) {
      events.value = []
      return
    }

    const timelineEvents = timelineWindow.value.getEvents()

    // Element Web pattern: decrypt from last to first for optimal UX
    if (options.client) {
      for (let i = timelineEvents.length - 1; i >= 0; --i) {
        options.client.decryptEventIfNeeded(timelineEvents[i])
      }
    }

    // Element Web pattern: add pending events if at live timeline end
    const allEvents = [...timelineEvents]
    if (!timelineWindow.value.canPaginate(EventTimeline.FORWARDS) && options.timelineSet) {
      try {
        // Only get pending events if the timeline set supports it
        const pendingEvents = options.timelineSet.getPendingEvents()
        allEvents.push(...pendingEvents)
      } catch (error) {
        // Some timeline sets (with chronological ordering) don't support getPendingEvents()
        logger.debug('Timeline set does not support getPendingEvents():', error.message)
      }
    }

    events.value = allEvents

    // Update pagination capabilities
    canPaginateBack.value = timelineWindow.value.canPaginate(EventTimeline.BACKWARDS)
    canPaginateForward.value = timelineWindow.value.canPaginate(EventTimeline.FORWARDS)
  }

  // Initialize timeline
  const initializeTimeline = async (eventId?: string): Promise<void> => {
    if (!options.client || !options.timelineSet) {
      logger.warn('Cannot initialize timeline: missing client or timelineSet')
      return
    }

    isLoading.value = true

    try {
      // Create new TimelineWindow instance
      timelineWindow.value = new TimelineWindow(
        options.client,
        options.timelineSet,
        { windowLimit: options.windowLimit }
      )

      // Load initial events
      await timelineWindow.value.load(eventId, INITIAL_LOAD_SIZE)
      refreshEvents()

      logger.debug('Timeline initialized successfully', {
        eventCount: events.value.length,
        canPaginateBack: canPaginateBack.value,
        canPaginateForward: canPaginateForward.value
      })
    } catch (error) {
      logger.error('Failed to initialize timeline:', error)
      events.value = []
    } finally {
      isLoading.value = false
    }
  }

  // Paginate in specified direction
  const paginate = async (direction: Direction): Promise<boolean> => {
    if (!timelineWindow.value) return false

    const isBackward = direction === EventTimeline.BACKWARDS
    const paginatingRef = isBackward ? isPaginatingBack : isPaginatingForward
    const canPaginateRef = isBackward ? canPaginateBack : canPaginateForward

    if (paginatingRef.value || !canPaginateRef.value) {
      return false
    }

    paginatingRef.value = true

    try {
      const success = await timelineWindow.value.paginate(direction, PAGINATION_SIZE)
      refreshEvents()
      return success
    } catch (error) {
      logger.error('Pagination failed:', error)
      return false
    } finally {
      paginatingRef.value = false
    }
  }

  // Convenience methods
  const loadOlderMessages = () => paginate(EventTimeline.BACKWARDS)
  const loadNewerMessages = () => paginate(EventTimeline.FORWARDS)

  // Check if at live timeline end
  const isAtLiveEnd = computed(() => {
    return timelineWindow.value && !timelineWindow.value.canPaginate(EventTimeline.FORWARDS)
  })

  // Event listeners for live updates
  const eventListeners: Array<() => void> = []

  const setupEventListeners = () => {
    if (!options.client || !options.timelineSet) return

    // Handle new timeline events
    const onTimelineEvent = (event: MatrixEvent) => {
      logger.debug('🔄 Timeline event received:', {
        eventType: event.getType(),
        eventId: event.getId(),
        isAtLiveEnd: isAtLiveEnd.value
      })
      
      // Always refresh for new events - we want to see new messages immediately
      // This is different from Element Web's approach but better for a chat-focused interface
      logger.debug('Timeline event received, refreshing:', event.getType())
      refreshEvents()
    }

    // Handle event decryption
    const onEventDecrypted = (event: MatrixEvent) => {
      const isEventInTimeline = events.value.some(e => e.getId() === event.getId())
      if (isEventInTimeline) {
        refreshEvents()
      }
    }

    // Handle event redaction
    const onEventRedacted = (event: MatrixEvent) => {
      const redactsEventId = event.getContent().redacts
      logger.debug('🗑️ Redaction event received:', {
        redactionEventId: event.getId(),
        redactsEventId,
        eventType: event.getType()
      })
      
      // Check if the redacted event is in our timeline
      const redactedEvent = events.value.find(e => e.getId() === redactsEventId)
      if (redactedEvent) {
        logger.debug('Redacted event found in timeline, refreshing:', redactsEventId)
        // Force a refresh to update the UI
        setTimeout(() => refreshEvents(), 100)
      }
    }

    // Add listeners
    const room = options.timelineSet?.room
    if (room) {
      room.on(RoomEvent.Timeline, onTimelineEvent)
      room.on(RoomEvent.Redaction, onEventRedacted)
      eventListeners.push(() => room.off(RoomEvent.Timeline, onTimelineEvent))
      eventListeners.push(() => room.off(RoomEvent.Redaction, onEventRedacted))
    }

    options.client.on(MatrixEventEvent.Decrypted, onEventDecrypted)
    eventListeners.push(() => options.client!.off(MatrixEventEvent.Decrypted, onEventDecrypted))
  }

  const cleanupEventListeners = () => {
    eventListeners.forEach(cleanup => cleanup())
    eventListeners.splice(0, eventListeners.length)
  }

  // Watch for timelineSet changes
  watch(() => options.timelineSet, async (newTimelineSet) => {
    if (newTimelineSet) {
      cleanupEventListeners()
      await initializeTimeline(options.eventId)
      setupEventListeners()
    }
  }, { immediate: true })

  // Lifecycle management
  onMounted(() => {
    setupEventListeners()
  })

  onUnmounted(() => {
    cleanupEventListeners()
  })

  return {
    // Reactive state
    events: computed(() => events.value),
    isLoading: computed(() => isLoading.value),
    canPaginateBack: computed(() => canPaginateBack.value),
    canPaginateForward: computed(() => canPaginateForward.value),
    isPaginatingBack: computed(() => isPaginatingBack.value),
    isPaginatingForward: computed(() => isPaginatingForward.value),
    isAtLiveEnd,

    // Methods
    initializeTimeline,
    loadOlderMessages,
    loadNewerMessages,
    refreshEvents
  }
}
