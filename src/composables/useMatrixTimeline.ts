/**
 * Matrix Timeline Composable - Following Matrix JS SDK best practices
 *
 * This composable provides timeline functionality using the Matrix JS SDK's
 * TimelineWindow class, following established patterns for reliable timeline management.
 */

import { ref, computed, onMounted, onUnmounted, watch, readonly } from 'vue'
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

// Optimized pagination configuration for better performance
const PAGINATION_SIZE = 10 // Load 10 messages per pagination request
const INITIAL_LOAD_SIZE = 10 // Initial load only 10 messages

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
  // Decryption reactivity - incremented when events get decrypted
  const decryptionCounter = ref(0)

  // Extract events from TimelineWindow and handle decryption - Element Web pattern
  const refreshEvents = (skipIfOnlyNewMessages = false): void => {
    if (!timelineWindow.value) {
      logger.debug('⚠️ refreshEvents called but no timeline window available')
      events.value = []
      return
    }

    const timelineEvents = timelineWindow.value.getEvents()
    logger.debug('🔄 refreshEvents called:', {
      timelineEventsCount: timelineEvents.length,
      currentEventsCount: events.value.length,
      skipIfOnlyNewMessages
    })

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

    // Optimize updates: only replace array if content actually changed
    const currentEvents = events.value
    const redactionChanges = allEvents.map((event, index) => {
      const currentEvent = currentEvents[index]
      const redactionChanged = currentEvent && event.getId() === currentEvent.getId() &&
                              event.isRedacted() !== currentEvent.isRedacted()
      return {
        eventId: event.getId(),
        redactionChanged,
        isRedacted: event.isRedacted(),
        wasRedacted: currentEvent?.isRedacted()
      }
    }).filter(change => change.redactionChanged)

    // Optimization: Check if we're only adding new messages to the end (most common case)
    const isOnlyNewMessagesAtEnd = currentEvents.length > 0 &&
                                  allEvents.length > currentEvents.length &&
                                  allEvents.slice(0, currentEvents.length).every((event, index) =>
                                    event.getId() === currentEvents[index]?.getId()
                                  )

    // Skip full refresh if we're only adding new messages and caller requested optimization
    if (skipIfOnlyNewMessages && isOnlyNewMessagesAtEnd) {
      // Optimized incremental update - only append new messages
      const newMessages = allEvents.slice(currentEvents.length)
      // Create new array reference to ensure Vue reactivity
      events.value = [...currentEvents, ...newMessages]
      logger.debug('⚡ Incremental update - added new messages:', {
        newMessageCount: newMessages.length,
        totalCount: events.value.length,
        lastNewEventId: newMessages[newMessages.length - 1]?.getId()
      })
      return
    }

    const hasChanged = allEvents.length !== currentEvents.length ||
                      allEvents.some((event, index) => {
                        const currentEvent = currentEvents[index]
                        return !currentEvent ||
                               event.getId() !== currentEvent.getId() ||
                               event.isRedacted() !== currentEvent.isRedacted()
                      })

    if (redactionChanges.length > 0) {
      logger.debug('🗑️ REDACTION CHANGES DETECTED:', redactionChanges)
    }

    if (hasChanged) {
      // Force reactivity by creating a new array reference
      events.value = [...allEvents]
      logger.debug('✅ Events updated (full refresh):', {
        finalEventCount: allEvents.length,
        redactionChanges: redactionChanges.length,
        lastEventId: allEvents[allEvents.length - 1]?.getId(),
        lastEventType: allEvents[allEvents.length - 1]?.getType(),
        previousCount: currentEvents.length,
        wasChanged: true,
        wasIncremental: false
      })
    } else {
      logger.debug('⚡ Events refresh skipped - no changes detected:', {
        eventCount: allEvents.length,
        lastEventId: allEvents[allEvents.length - 1]?.getId()
      })
    }

    // Update pagination capabilities
    canPaginateBack.value = timelineWindow.value.canPaginate(EventTimeline.BACKWARDS)
    canPaginateForward.value = timelineWindow.value.canPaginate(EventTimeline.FORWARDS)
  }

  // Initialize timeline
  const initializeTimeline = async (eventId?: string, client?: MatrixClient, timelineSet?: EventTimelineSet): Promise<void> => {
    const currentClient = client || options.client
    const currentTimelineSet = timelineSet || options.timelineSet

    if (!currentClient || !currentTimelineSet) {
      logger.warn('Cannot initialize timeline: missing client or timelineSet', {
        hasClient: !!currentClient,
        hasTimelineSet: !!currentTimelineSet,
        optionsClient: !!options.client,
        optionsTimelineSet: !!options.timelineSet
      })
      return
    }

    // Update options if new client/timelineSet provided
    if (client && client !== options.client) {
      options.client = client
    }
    if (timelineSet && timelineSet !== options.timelineSet) {
      options.timelineSet = timelineSet
    }

    // Set up event listeners if we have both client and timelineSet
    if (options.client && options.timelineSet) {
      // Clean up old listeners first
      cleanupEventListeners()
      // Set up new listeners
      setupEventListeners()
    }

    isLoading.value = true

    try {
      // Create new TimelineWindow instance
      timelineWindow.value = new TimelineWindow(
        currentClient,
        currentTimelineSet,
        { windowLimit: options.windowLimit }
      )

      // Load initial events with optimized batch size
      logger.debug(`🚀 Loading initial ${INITIAL_LOAD_SIZE} messages (optimized for performance)`)
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
      logger.debug(`📖 Loading ${PAGINATION_SIZE} more messages (${direction === EventTimeline.BACKWARDS ? 'older' : 'newer'})`)
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
    if (!options.client || !options.timelineSet) {
      logger.debug('⚠️ Cannot setup event listeners - missing client or timelineSet:', {
        hasClient: !!options.client,
        hasTimelineSet: !!options.timelineSet
      })
      return
    }

    logger.debug('🎧 Setting up timeline event listeners for room:', options.timelineSet.room?.roomId)

    // Handle new timeline events
    const onTimelineEvent = async (event: MatrixEvent) => {
      const isRedactionEvent = event.getType() === 'm.room.redaction'
      logger.debug('🔄 Timeline event received:', {
        eventType: event.getType(),
        eventId: event.getId(),
        roomId: event.getRoomId(),
        isAtLiveEnd: isAtLiveEnd.value,
        canPaginateForward: timelineWindow.value?.canPaginate(EventTimeline.FORWARDS),
        isRedactionEvent,
        redactsEventId: isRedactionEvent ? (event.event?.redacts || event.getContent()?.redacts) : null
      })

      // If this is a redaction event, log extra details
      if (isRedactionEvent) {
        const redactsEventId = event.event?.redacts || event.getContent()?.redacts
        const targetEvent = events.value.find(e => e.getId() === redactsEventId)
        logger.debug('🗑️ REDACTION VIA TIMELINE:', {
          redactionEventId: event.getId(),
          redactsEventId,
          targetEventFound: !!targetEvent,
          targetEventType: targetEvent?.getType(),
          currentTimelineLength: events.value.length
        })
      }

      // If we're not at the live end, we need to move the timeline window to include new events
      if (timelineWindow.value && !isAtLiveEnd.value) {
        logger.debug('📍 Not at live end, moving timeline window to include new event')
        try {
          // Try to paginate forward to include the new event
          const success = await timelineWindow.value.paginate(EventTimeline.FORWARDS, 50)
          logger.debug('📍 Timeline pagination result:', success)
        } catch (error) {
          logger.warn('⚠️ Failed to paginate timeline forward:', error)
        }
      }

      // Optimize refresh for regular messages - use incremental update when possible
      const isRegularMessage = event.getType() === 'm.room.message' || event.getType() === 'm.room.encrypted'
      logger.debug('Timeline event received, refreshing:', event.getType(), 'isRegular:', isRegularMessage)

      // Use incremental update for regular messages to avoid image reloads
      refreshEvents(isRegularMessage)
    }

    // Handle event decryption
    const onEventDecrypted = (event: MatrixEvent) => {
      const isEventInTimeline = events.value.some(e => e.getId() === event.getId())
      logger.debug('🔓 Timeline onEventDecrypted called:', {
        eventId: event.getId(),
        eventType: event.getType(),
        isEventInTimeline,
        willRefresh: isEventInTimeline
      })
      if (isEventInTimeline) {
        // Increment decryption counter to force EventTile re-renders
        decryptionCounter.value++
        logger.debug('🔓 Decryption counter incremented:', {
          eventId: event.getId(),
          counter: decryptionCounter.value
        })
        refreshEvents() // Full refresh for decryption changes
      }
    }

    // Handle event redaction
    const onEventRedacted = (event: MatrixEvent) => {
      // For redaction events, check both content.redacts and the redacts field
      const redactsEventId = event.event?.redacts || event.getContent()?.redacts
      logger.debug('🗑️ RoomEvent.Redaction received:', {
        redactionEventId: event.getId(),
        redactsEventId,
        eventType: event.getType(),
        content: event.getContent(),
        eventRedacts: event.event?.redacts
      })

      if (!redactsEventId) {
        logger.warn('🗑️ Redaction event missing redacts field')
        return
      }

      // Check if the redacted event is in our timeline
      const redactedEvent = events.value.find(e => e.getId() === redactsEventId)
      if (redactedEvent) {
        logger.debug('🗑️ REDACTION MATCH: Event found in timeline, forcing refresh:', {
          redactedEventId: redactsEventId,
          redactedEventType: redactedEvent.getType(),
          wasRedactedBefore: redactedEvent.isRedacted(),
          timelineLength: events.value.length
        })
        // Skip normal refreshEvents() since it will skip due to "no changes detected"
        // Instead, force immediate Vue reactivity update
        if (timelineWindow.value) {
          const timelineEvents = timelineWindow.value.getEvents()
          const allEvents = [...timelineEvents]
          events.value = [...allEvents]
          // Also increment decryption counter to force Vue re-render
          decryptionCounter.value++
          logger.debug('🗑️ FORCED redaction update - bypassed change detection:', {
            eventCount: allEvents.length,
            redactedEventId: redactsEventId,
            newDecryptionCounter: decryptionCounter.value
          })
        }
      } else {
        logger.debug('🗑️ Redacted event not found in current timeline:', redactsEventId)
      }
    }

    // Handle when an event gets replaced/redacted
    const onEventReplaced = (event: MatrixEvent) => {
      const isEventInTimeline = events.value.some(e => e.getId() === event.getId())
      logger.debug('🔄 MatrixEventEvent.Replaced received:', {
        eventId: event.getId(),
        eventType: event.getType(),
        isEventInTimeline,
        isRedacted: event.isRedacted(),
        willRefresh: isEventInTimeline
      })
      if (isEventInTimeline) {
        logger.debug('🔄 REPLACED MATCH: Event found in timeline, forcing refresh immediately')
        // Skip normal refreshEvents() since it may skip due to change detection
        // Instead, force immediate Vue reactivity update
        if (timelineWindow.value) {
          const timelineEvents = timelineWindow.value.getEvents()
          const allEvents = [...timelineEvents]
          events.value = [...allEvents]
          // Also increment decryption counter to force Vue re-render
          decryptionCounter.value++
          logger.debug('🔄 FORCED replacement update - bypassed change detection:', {
            eventCount: allEvents.length,
            replacedEventId: event.getId(),
            newDecryptionCounter: decryptionCounter.value
          })
        }
      }
    }

    // Handle timeline reset (may occur after redactions)
    const onTimelineReset = () => {
      logger.debug('🔄 Timeline reset triggered, refreshing events')
      refreshEvents()
    }

    // Add listeners
    const room = options.timelineSet?.room
    if (room) {
      logger.debug('🎧 Adding room event listeners for:', room.roomId)
      room.on(RoomEvent.Timeline, onTimelineEvent)
      room.on(RoomEvent.Redaction, onEventRedacted)
      room.on(RoomEvent.TimelineReset, onTimelineReset)
      eventListeners.push(() => room.off(RoomEvent.Timeline, onTimelineEvent))
      eventListeners.push(() => room.off(RoomEvent.Redaction, onEventRedacted))
      eventListeners.push(() => room.off(RoomEvent.TimelineReset, onTimelineReset))
      logger.debug('✅ Room event listeners added')
    } else {
      logger.warn('⚠️ No room found for timeline event listeners')
    }

    logger.debug('🎧 Adding client event listeners for decryption and replacement')
    options.client.on(MatrixEventEvent.Decrypted, onEventDecrypted)
    options.client.on(MatrixEventEvent.Replaced, onEventReplaced)
    eventListeners.push(() => options.client!.off(MatrixEventEvent.Decrypted, onEventDecrypted))
    eventListeners.push(() => options.client!.off(MatrixEventEvent.Replaced, onEventReplaced))
    logger.debug('✅ All event listeners setup complete')
  }

  const cleanupEventListeners = () => {
    eventListeners.forEach(cleanup => cleanup())
    eventListeners.splice(0, eventListeners.length)
  }

  // Watch for timelineSet changes - use direct options access for better reactivity
  watch(() => [options.client, options.timelineSet], async ([newClient, newTimelineSet]: [MatrixClient | undefined, EventTimelineSet | undefined]) => {
    if (newTimelineSet && newClient) {
      logger.debug('🔄 Timeline dependencies updated:', {
        hasTimelineSet: !!newTimelineSet,
        hasClient: !!newClient
      })
      cleanupEventListeners()
      await initializeTimeline(options.eventId, newClient, newTimelineSet)
      setupEventListeners()
    }
  }, { immediate: true })

  // Lifecycle management - both watch and onMounted for reliability
  onMounted(async () => {
    // Fallback setup in case watch doesn't trigger properly
    if (options.client && options.timelineSet) {
      logger.debug('🔄 onMounted fallback: setting up timeline')
      await initializeTimeline()
      setupEventListeners()
    }
  })

  onUnmounted(() => {
    cleanupEventListeners()
  })

  return {
    // Reactive state - return refs directly for better reactivity
    events: readonly(events),
    isLoading: readonly(isLoading),
    canPaginateBack: readonly(canPaginateBack),
    canPaginateForward: readonly(canPaginateForward),
    isPaginatingBack: readonly(isPaginatingBack),
    isPaginatingForward: readonly(isPaginatingForward),
    isAtLiveEnd,
    decryptionCounter: readonly(decryptionCounter),

    // Methods
    initializeTimeline,
    loadOlderMessages,
    loadNewerMessages,
    refreshEvents
  }
}
