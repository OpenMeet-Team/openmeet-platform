<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useQuasar } from 'quasar'
import { getExternalEvents, type ExternalEvent } from '../../api/calendar'
import { useAuthStore } from '../../stores/auth-store'
import { useHomeStore } from '../../stores/home-store'
import { useDashboardStore } from '../../stores/dashboard-store'
import { EventStatus } from '../../types/event'

interface GroupEvent {
  ulid: string
  slug: string
  name: string
  startDate: string
  endDate?: string
  isAllDay?: boolean
  status?: string
}

interface CalendarEvent {
  id: string
  title: string
  date: string
  time?: string
  startDateTime?: string
  endDateTime?: string
  type: 'attending' | 'hosting' | 'external-event' | 'external-conflict' | 'cancelled'
  bgColor: string
  textColor?: string
  slug?: string
  isAllDay?: boolean
  location?: string
  description?: string
  isCancelled?: boolean
}

interface Props {
  mode?: 'month' | 'week' | 'day'
  height?: string
  showControls?: boolean
  compact?: boolean
  startDate?: string
  endDate?: string
  groupEvents?: GroupEvent[]
  externalEvents?: ExternalEvent[]
  legendType?: 'personal' | 'group'
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'month',
  height: '400px',
  showControls: true,
  compact: false,
  groupEvents: () => [] as GroupEvent[],
  externalEvents: () => [],
  legendType: 'personal'
})

const emit = defineEmits<{
  eventClick: [event: CalendarEvent]
  dateClick: [date: string]
  dateSelect: [date: string]
  externalEventsLoaded: [events: ExternalEvent[]]
}>()

const $q = useQuasar()
const authStore = useAuthStore()
const homeStore = useHomeStore()
const dashboardStore = useDashboardStore()

// Initialize to current date in local timezone
const today = new Date()
const currentDate = ref(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`)
const selectedDate = ref(currentDate.value) // Track selected date for visual feedback
const viewMode = ref(props.mode)
const loading = ref(false)
const events = ref<CalendarEvent[]>([])
const loadedExternalEvents = ref<ExternalEvent[]>([])

// External events cache - we still need this for external calendar API calls
const externalEventsCache = ref(new Map<string, {
  data: ExternalEvent[],
  timestamp: number,
  ttl: number
}>())

// Helper function to create cache key for date ranges
function createDateRangeKey (start: string, end: string): string {
  return `${start}_${end}`
}

// Debouncing for rapid navigation
let loadEventsTimeout: ReturnType<typeof setTimeout> | null = null

function debouncedLoadEvents () {
  if (loadEventsTimeout) {
    clearTimeout(loadEventsTimeout)
  }
  loadEventsTimeout = setTimeout(loadEvents, 150) // 150ms debounce
}

// Calculate date range based on current view
const dateRange = computed(() => {
  // Parse the date string properly (YYYY-MM-DD format)
  const [yearStr, monthStr, dayStr] = currentDate.value.split('-')
  const year = parseInt(yearStr)
  const month = parseInt(monthStr) - 1 // Month is 0-based in JavaScript
  const day = parseInt(dayStr)

  const date = new Date(year, month, day)

  if (props.startDate && props.endDate) {
    return {
      start: props.startDate,
      end: props.endDate
    }
  }

  switch (viewMode.value) {
    case 'month': {
      const startOfMonth = new Date(year, month, 1)
      const endOfMonth = new Date(year, month + 1, 0)
      return {
        start: formatDateString(startOfMonth),
        end: formatDateString(endOfMonth)
      }
    }
    case 'week': {
      const startOfWeek = new Date(date)
      startOfWeek.setDate(date.getDate() - date.getDay())
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6)
      return {
        start: formatDateString(startOfWeek),
        end: formatDateString(endOfWeek)
      }
    }
    case 'day':
      return {
        start: currentDate.value,
        end: currentDate.value
      }
    default:
      return {
        start: currentDate.value,
        end: currentDate.value
      }
  }
})

// Generate calendar grid for month view
const calendarGrid = computed(() => {
  if (viewMode.value !== 'month') return []

  // Parse the date string properly (YYYY-MM-DD format)
  const [yearStr, monthStr] = currentDate.value.split('-')
  const year = parseInt(yearStr)
  const month = parseInt(monthStr) - 1 // Month is 0-based in JavaScript

  // First day of the month
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  // Start from Sunday of the week containing the first day
  const startDate = new Date(firstDay)
  startDate.setDate(startDate.getDate() - startDate.getDay())

  // End on Saturday of the week containing the last day
  const endDate = new Date(lastDay)
  endDate.setDate(endDate.getDate() + (6 - endDate.getDay()))

  const grid = []

  // Always generate 6 weeks (42 days) to ensure we show the complete month
  const weeksToShow = 6

  for (let weekIndex = 0; weekIndex < weeksToShow; weekIndex++) {
    const week = []

    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const currentDateIter = new Date(startDate)
      currentDateIter.setDate(startDate.getDate() + (weekIndex * 7) + dayIndex)

      const dateStr = formatDateString(currentDateIter)
      const isCurrentMonth = currentDateIter.getMonth() === month
      const todayStr = formatDateString(new Date())
      const isToday = dateStr === todayStr
      const dayEvents = events.value.filter(event => event.date === dateStr)

      week.push({
        date: dateStr,
        day: currentDateIter.getDate(),
        isCurrentMonth,
        isToday,
        isSelected: dateStr === selectedDate.value,
        events: dayEvents
      })
    }

    grid.push(week)
  }

  return grid
})

// Week days for header
const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Generate week grid for week view
const weekGrid = computed(() => {
  if (viewMode.value !== 'week') return []

  // Parse the date string properly (YYYY-MM-DD format)
  const [yearStr, monthStr, dayStr] = currentDate.value.split('-')
  const year = parseInt(yearStr)
  const month = parseInt(monthStr) - 1 // Month is 0-based in JavaScript
  const day = parseInt(dayStr)

  const date = new Date(year, month, day)
  const startOfWeek = new Date(date)
  startOfWeek.setDate(date.getDate() - date.getDay())

  const week = []
  for (let i = 0; i < 7; i++) {
    const currentDay = new Date(startOfWeek)
    currentDay.setDate(startOfWeek.getDate() + i)

    const dateStr = formatDateString(currentDay)
    const todayStr = formatDateString(new Date())
    const isToday = dateStr === todayStr

    week.push({
      date: dateStr,
      day: currentDay.getDate(),
      dayName: currentDay.toLocaleDateString('en-US', { weekday: 'short' }),
      isToday,
      isSelected: dateStr === selectedDate.value
    })
  }

  return week
})

// Time slots for day/week view (24 hours: 12 AM to 11 PM)
const timeSlots = Array.from({ length: 24 }, (_, i) => i)

// Helper function to format date as YYYY-MM-DD in local timezone
function formatDateString (date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// Helper function to expand multi-day events into daily instances
function expandMultiDayEvents (events: CalendarEvent[]): CalendarEvent[] {
  const expandedEvents: CalendarEvent[] = []

  for (const event of events) {
    // If the event has no end date or is the same day, just add it as-is
    if (!event.endDateTime || event.date === formatDateString(new Date(event.endDateTime))) {
      expandedEvents.push(event)
      continue
    }

    // Parse start and end dates
    const startDate = new Date(event.startDateTime || event.date + 'T00:00:00')
    const endDate = new Date(event.endDateTime)

    // If it's all-day or the end date is different, create instances for each day
    const currentDate = new Date(startDate)
    let dayIndex = 0

    // eslint-disable-next-line no-unmodified-loop-condition
    while (currentDate <= endDate) {
      const currentDateStr = formatDateString(currentDate)

      // Skip if we've gone past the end date (for safety)
      if (currentDate > endDate) break

      // Create an event instance for this day
      const dayEvent: CalendarEvent = {
        ...event,
        id: `${event.id}-day-${dayIndex}`,
        date: currentDateStr,
        // For first day, keep original time if not all-day
        // For middle/last days of multi-day events, make them all-day or adjust times
        time: event.isAllDay
          ? undefined
          : dayIndex === 0
            ? event.time // Keep original time for first day
            : undefined, // Make subsequent days all-day style
        isAllDay: event.isAllDay || dayIndex > 0 // Make subsequent days appear as all-day
      }

      // Add indicator for multi-day events
      if (dayIndex > 0) {
        dayEvent.title = `${event.title} (Day ${dayIndex + 1})`
      }

      expandedEvents.push(dayEvent)

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1)
      dayIndex++

      // Safety check to prevent infinite loops
      if (dayIndex >= 365) {
        console.warn('Multi-day event expansion stopped at 365 days to prevent infinite loop')
        break
      }
    }
  }

  return expandedEvents
}

// Note: getEventsForHour was used in previous implementation but is now replaced by precise positioning
// Keeping this comment for reference in case we need to revert to hour-based positioning

// Get all events for a specific date (for day/week views with precise positioning)
function getEventsForDate (date: string) {
  return events.value.filter(event => event.date === date)
}

// Calculate precise position within the entire day based on minutes
function getEventPosition (event: CalendarEvent) {
  if (event.isAllDay || !event.time) {
    return { top: '0px', height: '30px' }
  }

  const totalDayMinutes = 24 * 60 // 1440 minutes in a day

  // Handle time ranges (e.g., "14:00-16:00")
  if (event.time.includes('-')) {
    const [startTimeStr, endTimeStr] = event.time.split('-')
    const [startHour, startMinute = 0] = startTimeStr.split(':').map(Number)
    const [endHour, endMinute = 0] = endTimeStr.split(':').map(Number)

    // Calculate start position as percentage within the entire day
    const startTotalMinutes = startHour * 60 + startMinute
    const endTotalMinutes = endHour * 60 + endMinute
    const durationMinutes = endTotalMinutes - startTotalMinutes

    // Calculate position as percentage of the entire day
    const topPercentage = (startTotalMinutes / totalDayMinutes) * 100
    const heightPercentage = (durationMinutes / totalDayMinutes) * 100

    return {
      top: `${topPercentage}%`,
      height: `${heightPercentage}%`
    }
  }

  // Handle single time (e.g., "14:30")
  const [hour, minute = 0] = event.time.split(':').map(Number)
  const startTotalMinutes = hour * 60 + minute
  const topPercentage = (startTotalMinutes / totalDayMinutes) * 100

  // Default duration for single time events (1 hour)
  const defaultDurationMinutes = 60
  const heightPercentage = (defaultDurationMinutes / totalDayMinutes) * 100

  return {
    top: `${topPercentage}%`,
    height: `${heightPercentage}%`
  }
}

// Format hour for display
function formatHour (hour: number) {
  const period = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return `${displayHour}:00 ${period}`
}

// Format day name for day view
function formatDayName (dateStr: string) {
  // Parse the date string properly (YYYY-MM-DD format)
  const [yearStr, monthStr, dayStr] = dateStr.split('-')
  const year = parseInt(yearStr)
  const month = parseInt(monthStr) - 1 // Month is 0-based in JavaScript
  const day = parseInt(dayStr)

  const date = new Date(year, month, day)
  return date.toLocaleDateString('en-US', { weekday: 'long' })
}

// Extract day number from date string in local timezone
function getDayNumber (dateStr: string): number {
  // Parse the date string properly (YYYY-MM-DD format)
  const [, , dayStr] = dateStr.split('-')
  return parseInt(dayStr)
}

// Check if date is today
function isToday (date: string) {
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return date === todayStr
}

// Computed property to determine if we need to fetch fresh data (for future use)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const needsFreshData = computed(() => {
  // Check if stores are empty or loading
  if (!authStore.user) return false

  const needsUserEvents = !homeStore.userUpcomingEvents && !homeStore.loading
  const needsHostedEvents = !dashboardStore.events && !dashboardStore.loading

  return needsUserEvents || needsHostedEvents
})

async function loadEvents () {
  loading.value = true
  events.value = []

  try {
    const { start, end } = dateRange.value

    // Helper function to create event signature for deduplication
    const createEventSignature = (event: CalendarEvent) => {
      return `${event.title.toLowerCase().trim()}|${event.date}|${event.time || 'no-time'}`
    }

    let mainEvents: CalendarEvent[] = []

    // Check if we have group events passed as props (group calendar mode)
    if (props.groupEvents && props.groupEvents.length > 0) {
      // Use provided group events
      const filteredGroupEvents = props.groupEvents.filter(event => {
        const eventDate = event.startDate.split('T')[0]
        return eventDate >= start && eventDate <= end
      })

      mainEvents = filteredGroupEvents.map(event => {
        const startTime = new Date(event.startDate)
        const endTime = event.endDate ? new Date(event.endDate) : startTime

        // Format time display with end time if available
        const timeDisplay = event.isAllDay
          ? undefined
          : event.endDate
            ? `${startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}-${endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`
            : startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })

        const isCancelled = event.status === EventStatus.Cancelled
        return {
          id: `group-${event.ulid}`,
          title: event.name,
          date: event.startDate.split('T')[0],
          time: timeDisplay,
          startDateTime: event.startDate,
          endDateTime: event.endDate || event.startDate,
          type: isCancelled ? 'cancelled' : 'attending',
          bgColor: isCancelled ? '#f44336' : '#1976d2', // Red for cancelled, blue for normal
          textColor: '#ffffff',
          slug: event.slug,
          isAllDay: event.isAllDay || false,
          isCancelled
        }
      })
    } else if (authStore.user) {
      // Personal calendar mode - load user's events
      // Load events I'm attending (from home store)
      if (!homeStore.userUpcomingEvents) {
        await homeStore.actionGetUserHomeState()
      }
      const upcomingEvents = homeStore.userUpcomingEvents || []

      // Filter upcoming events by current date range
      const filteredUpcomingEvents = upcomingEvents.filter(event => {
        const eventDate = event.startDate.split('T')[0]
        return eventDate >= start && eventDate <= end
      })

      const attendingEvents: CalendarEvent[] = filteredUpcomingEvents.map(event => {
        const startTime = new Date(event.startDate)
        const endTime = event.endDate ? new Date(event.endDate) : startTime

        // Format time display with end time if available
        const timeDisplay = event.isAllDay
          ? undefined
          : event.endDate
            ? `${startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}-${endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`
            : startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })

        const isCancelled = event.status === EventStatus.Cancelled
        return {
          id: `attending-${event.ulid}`,
          title: event.name,
          date: event.startDate.split('T')[0],
          time: timeDisplay,
          startDateTime: event.startDate,
          endDateTime: event.endDate || event.startDate,
          type: isCancelled ? 'cancelled' : 'attending',
          bgColor: isCancelled ? '#f44336' : '#1976d2', // Red for cancelled, blue for normal
          textColor: '#ffffff',
          slug: event.slug,
          isAllDay: event.isAllDay || false,
          isCancelled
        }
      })

      // Load events I'm hosting (from dashboard store)
      if (!dashboardStore.events) {
        await dashboardStore.actionGetDashboardEvents()
      }
      const rawHostedEvents = dashboardStore.events || []

      const filteredHostedEvents = rawHostedEvents.filter(event => {
        const eventDate = event.startDate.split('T')[0]
        return eventDate >= start && eventDate <= end
      })

      const hostedEvents: CalendarEvent[] = filteredHostedEvents.map(event => {
        const startTime = new Date(event.startDate)
        const endTime = event.endDate ? new Date(event.endDate) : startTime

        // Format time display with end time if available
        const timeDisplay = event.isAllDay
          ? undefined
          : event.endDate
            ? `${startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}-${endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`
            : startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })

        const isCancelled = event.status === EventStatus.Cancelled
        return {
          id: `hosted-${event.ulid}`,
          title: `${event.name} (hosting)`,
          date: event.startDate.split('T')[0],
          time: timeDisplay,
          startDateTime: event.startDate,
          endDateTime: event.endDate || event.startDate,
          type: isCancelled ? 'cancelled' : 'hosting',
          bgColor: isCancelled ? '#f44336' : '#2e7d32', // Red for cancelled, green for normal
          textColor: '#ffffff',
          slug: event.slug,
          isAllDay: event.isAllDay || false,
          isCancelled
        }
      })

      // Combine events (remove duplicates by ulid and title+time)
      const eventUlids = new Set()
      const eventSignatures = new Set() // For title+date+time deduplication

      // Add attending events first
      for (const event of attendingEvents) {
        const ulid = event.id.split('-')[1]
        const signature = createEventSignature(event)
        if (!eventUlids.has(ulid) && !eventSignatures.has(signature)) {
          eventUlids.add(ulid)
          eventSignatures.add(signature)
          mainEvents.push(event)
        }
      }

      // Add hosted events if not already attending
      for (const event of hostedEvents) {
        const ulid = event.id.split('-')[1]
        const signature = createEventSignature(event)
        if (!eventUlids.has(ulid) && !eventSignatures.has(signature)) {
          eventUlids.add(ulid)
          eventSignatures.add(signature)
          mainEvents.push(event)
        }
      }
    }

    // Handle external calendar events
    const externalCalendarEvents: CalendarEvent[] = []
    const eventSignatures = new Set(mainEvents.map(createEventSignature))

    // Check if external events are provided as props
    if (props.externalEvents && props.externalEvents.length > 0) {
      // Use provided external events
      const formattedExternalEvents = props.externalEvents.map(event => {
        const startTime = new Date(event.startTime)
        const endTime = event.endTime ? new Date(event.endTime) : startTime

        // Format time display with end time if available
        const timeDisplay = event.isAllDay
          ? undefined
          : event.endTime
            ? `${startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}-${endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`
            : startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })

        // Try multiple possible title fields from the API
        const eventData = event as unknown as Record<string, unknown>
        const possibleTitle = eventData.summary || eventData.title || eventData.name || eventData.subject || 'External Event'

        return {
          id: `external-${event.id}`,
          title: String(possibleTitle),
          date: formatDateString(startTime),
          time: timeDisplay,
          startDateTime: event.startTime,
          endDateTime: event.endTime || event.startTime,
          type: 'external-event' as const,
          bgColor: '#4caf50',
          textColor: '#fff',
          isAllDay: event.isAllDay,
          location: event.location,
          description: event.description
        }
      })

      // Add external events with deduplication
      for (const event of formattedExternalEvents) {
        const signature = createEventSignature(event)
        if (!eventSignatures.has(signature)) {
          eventSignatures.add(signature)
          externalCalendarEvents.push(event)
        }
      }
    } else if (authStore.user) {
      // Load external calendar events via API for personal calendar
      try {
        const cacheKey = createDateRangeKey(start, end)
        let externalEventsData: ExternalEvent[] = []

        // Check cache first
        const cachedData = externalEventsCache.value.get(cacheKey)
        if (cachedData && Date.now() - cachedData.timestamp < cachedData.ttl) {
          externalEventsData = cachedData.data
        } else {
          // Fetch from API and cache
          const externalResponse = await getExternalEvents({
            startTime: `${start}T00:00:00Z`,
            endTime: `${end}T23:59:59Z`
          })

          externalEventsData = externalResponse.data.events || []

          // Cache the response for 10 minutes
          externalEventsCache.value.set(cacheKey, {
            data: externalEventsData,
            timestamp: Date.now(),
            ttl: 10 * 60 * 1000 // 10 minutes
          })
        }

        if (externalEventsData.length > 0) {
          const formattedExternalEvents = externalEventsData.map(event => {
            const startTime = new Date(event.startTime)
            const endTime = event.endTime ? new Date(event.endTime) : startTime

            // Format time display with end time if available
            const timeDisplay = event.isAllDay
              ? undefined
              : event.endTime
                ? `${startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}-${endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`
                : startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })

            // Try multiple possible title fields from the API
            const eventData = event as unknown as Record<string, unknown>
            const possibleTitle = eventData.summary || eventData.title || eventData.name || eventData.subject || 'External Event'

            return {
              id: `external-${event.id}`,
              title: String(possibleTitle),
              date: formatDateString(startTime),
              time: timeDisplay,
              startDateTime: event.startTime,
              endDateTime: event.endTime || event.startTime,
              type: 'external-event' as const,
              bgColor: '#4caf50',
              textColor: '#fff',
              isAllDay: event.isAllDay,
              location: event.location,
              description: event.description
            }
          })

          // Add external events with deduplication
          for (const event of formattedExternalEvents) {
            const signature = createEventSignature(event)
            if (!eventSignatures.has(signature)) {
              eventSignatures.add(signature)
              externalCalendarEvents.push(event)
            }
          }

          loadedExternalEvents.value = externalEventsData
          emit('externalEventsLoaded', loadedExternalEvents.value)
        }
      } catch (error) {
        console.warn('Failed to load external calendar events:', error)
      }
    }

    // Expand multi-day events into daily instances before assigning
    const allEvents = [...mainEvents, ...externalCalendarEvents]
    events.value = expandMultiDayEvents(allEvents)
  } catch (error) {
    console.error('Failed to load calendar events:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to load calendar events'
    })
  } finally {
    loading.value = false
  }
}

function navigateDate (direction: 'prev' | 'next') {
  // Parse the current date string properly (YYYY-MM-DD format)
  const [yearStr, monthStr, dayStr] = currentDate.value.split('-')
  const year = parseInt(yearStr)
  const month = parseInt(monthStr) - 1 // Month is 0-based in JavaScript
  const day = parseInt(dayStr)

  const date = new Date(year, month, day)

  switch (viewMode.value) {
    case 'month':
      date.setMonth(date.getMonth() + (direction === 'next' ? 1 : -1))
      break
    case 'week':
      date.setDate(date.getDate() + (direction === 'next' ? 7 : -7))
      break
    case 'day':
      date.setDate(date.getDate() + (direction === 'next' ? 1 : -1))
      break
  }

  // Format back to YYYY-MM-DD
  const newYear = date.getFullYear()
  const newMonth = date.getMonth() + 1
  const newDay = date.getDate()
  currentDate.value = `${newYear}-${String(newMonth).padStart(2, '0')}-${String(newDay).padStart(2, '0')}`
}

function goToToday () {
  currentDate.value = formatDateString(new Date())
}

function onEventClick (event: CalendarEvent) {
  // Map our event types to what the parent expects
  const eventToEmit: CalendarEvent = {
    ...event,
    type: event.type === 'external-event' ? 'external-conflict' : event.type
  }
  emit('eventClick', eventToEmit)
}

function onDateSelect (date: string) {
  // Update selected date for visual feedback
  selectedDate.value = date
  // Update current date based on view mode for navigation
  if (viewMode.value === 'day') {
    currentDate.value = date
  } else if (viewMode.value === 'week') {
    // Center the week view on the selected date
    currentDate.value = date
  }
  emit('dateSelect', date)
}

function onDateClick (date: string) {
  // This is for creating new events on this date
  emit('dateClick', date)
}

// Format current date for display
const currentDateLabel = computed(() => {
  // Parse the date string properly (YYYY-MM-DD format)
  const [yearStr, monthStr, dayStr] = currentDate.value.split('-')
  const year = parseInt(yearStr)
  const month = parseInt(monthStr) - 1 // Month is 0-based in JavaScript
  const day = parseInt(dayStr)

  const date = new Date(year, month, day)
  const options: Intl.DateTimeFormatOptions =
    viewMode.value === 'month'
      ? { year: 'numeric', month: 'long' }
      : viewMode.value === 'week'
        ? { year: 'numeric', month: 'short', day: 'numeric' }
        : { year: 'numeric', month: 'long', day: 'numeric' }

  return date.toLocaleDateString('en-US', options)
})

// Watch for changes to reload events with debouncing
watch([currentDate, viewMode], debouncedLoadEvents)
watch(() => props.startDate, debouncedLoadEvents)
watch(() => props.endDate, debouncedLoadEvents)

// Watch for view mode changes to update current date based on selected date
watch(viewMode, (newMode) => {
  if (newMode === 'day') {
    // When switching to day view, use the selected date
    currentDate.value = selectedDate.value
  } else if (newMode === 'week') {
    // When switching to week view, use the selected date to center the week
    currentDate.value = selectedDate.value
  }
})

onMounted(() => {
  if (authStore.user) {
    loadEvents()
  }
})
</script>

<template>
  <div class="custom-calendar">
    <!-- Calendar Controls -->
    <div v-if="showControls" class="calendar-controls q-mb-md">
      <div class="row items-center justify-between">
        <div class="row items-center q-gutter-sm">
          <q-btn
            flat
            round
            icon="sym_r_chevron_left"
            @click="navigateDate('prev')"
            :disable="loading"
          />
          <q-btn
            flat
            :label="currentDateLabel"
            @click="goToToday"
            :disable="loading"
            class="text-h6"
          />
          <q-btn
            flat
            round
            icon="sym_r_chevron_right"
            @click="navigateDate('next')"
            :disable="loading"
          />
        </div>

        <div class="row q-gutter-xs">
          <q-btn
            :flat="viewMode !== 'day'"
            :unelevated="viewMode === 'day'"
            :color="viewMode === 'day' ? 'primary' : 'grey-7'"
            label="Day"
            size="sm"
            @click="viewMode = 'day'"
            :disable="loading"
          />
          <q-btn
            :flat="viewMode !== 'week'"
            :unelevated="viewMode === 'week'"
            :color="viewMode === 'week' ? 'primary' : 'grey-7'"
            label="Week"
            size="sm"
            @click="viewMode = 'week'"
            :disable="loading"
          />
          <q-btn
            :flat="viewMode !== 'month'"
            :unelevated="viewMode === 'month'"
            :color="viewMode === 'month' ? 'primary' : 'grey-7'"
            label="Month"
            size="sm"
            @click="viewMode = 'month'"
            :disable="loading"
          />
        </div>
      </div>
    </div>

    <!-- Calendar Container -->
    <div class="calendar-container" :style="{ height: viewMode === 'month' ? 'auto' : height }">
      <q-inner-loading :showing="loading">
        <q-spinner-dots size="40px" color="primary" />
      </q-inner-loading>

      <!-- Month View -->
      <div v-if="viewMode === 'month'" class="month-view">
        <!-- Week day headers -->
        <div class="week-header">
          <div v-for="day in weekDays" :key="day" class="day-header">
            {{ day }}
          </div>
        </div>

        <!-- Calendar grid -->
        <div class="calendar-grid">
          <div v-for="(week, weekIndex) in calendarGrid" :key="weekIndex" class="calendar-week">
            <div
              v-for="day in week"
              :key="day.date"
              class="calendar-day"
              :class="{
                'other-month': !day.isCurrentMonth,
                'today': day.isToday,
                'selected': day.isSelected
              }"
            >
              <!-- Day number - clickable for selection -->
              <div class="day-number-container" @click="onDateSelect(day.date)">
                <div class="day-number">
                  {{ day.day }}
                </div>
              </div>

              <!-- Add event button -->
              <div class="add-event-btn" @click="onDateClick(day.date)" v-if="day.isCurrentMonth">
                <q-icon name="sym_r_add" size="12px" />
              </div>

              <!-- Events -->
              <div class="events-container">
                <div
                  v-for="event in day.events.slice(0, 3)"
                  :key="event.id"
                  class="event-bar"
                  :style="{
                    backgroundColor: event.bgColor,
                    color: event.textColor || '#ffffff'
                  }"
                  @click.stop="onEventClick(event)"
                >
                  {{ event.title }}
                </div>
                <div v-if="day.events.length > 3" class="more-events">
                  +{{ day.events.length - 3 }} more
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Week View -->
      <div v-else-if="viewMode === 'week'" class="week-view">
        <!-- Week day headers -->
        <div class="week-header">
          <div class="time-column"></div>
          <div v-for="day in weekGrid" :key="day.date" class="day-header" :class="{ 'selected': day.isSelected }">
            <div class="day-header-content" @click="onDateSelect(day.date)">
              <div class="day-name">{{ day.dayName }}</div>
              <div class="day-number" :class="{ 'today': day.isToday }">{{ day.day }}</div>
            </div>
            <div class="day-add-btn" @click="onDateClick(day.date)">
              <q-icon name="sym_r_add" size="12px" />
            </div>
          </div>
        </div>

        <!-- Time slots with precise positioning -->
        <div class="week-content">
          <div class="week-time-grid">
            <!-- Time labels column -->
            <div class="time-labels-column">
              <div v-for="hour in timeSlots" :key="hour" class="time-label-row">
                <div class="time-label">{{ formatHour(hour) }}</div>
              </div>
            </div>

            <!-- Days columns with events -->
            <div v-for="day in weekGrid" :key="day.date" class="day-column">
              <!-- Hour grid background -->
              <div v-for="hour in timeSlots" :key="hour" class="hour-slot"></div>

              <!-- Events positioned absolutely -->
              <div class="events-overlay">
                <div
                  v-for="event in getEventsForDate(day.date)"
                  :key="event.id"
                  class="positioned-event"
                  :class="{ 'all-day-event': event.isAllDay }"
                  :style="{
                    backgroundColor: event.bgColor,
                    color: event.textColor || '#ffffff',
                    top: getEventPosition(event).top,
                    height: getEventPosition(event).height
                  }"
                  @click="onEventClick(event)"
                >
                  {{ event.title }}
                  <div v-if="!event.isAllDay" class="event-time">{{ event.time }}</div>
                  <div v-else class="all-day-label">All Day</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Day View -->
      <div v-else-if="viewMode === 'day'" class="day-view">
        <!-- Day header -->
        <div class="day-header-bar">
          <div class="day-info">
            <div class="day-name">{{ formatDayName(currentDate) }}</div>
            <div class="day-number" :class="{ 'today': isToday(currentDate) }">
              {{ getDayNumber(currentDate) }}
            </div>
          </div>
        </div>

        <!-- Time slots for day with precise positioning -->
        <div class="day-content">
          <div class="day-time-grid">
            <!-- Time labels column -->
            <div class="time-labels-column">
              <div v-for="hour in timeSlots" :key="hour" class="time-label-row">
                <div class="time-label">{{ formatHour(hour) }}</div>
              </div>
            </div>

            <!-- Single day column with events -->
            <div class="day-column">
              <!-- Hour grid background -->
              <div v-for="hour in timeSlots" :key="hour" class="hour-slot"></div>

              <!-- Events positioned absolutely -->
              <div class="events-overlay">
                <div
                  v-for="event in getEventsForDate(currentDate)"
                  :key="event.id"
                  class="positioned-event day-event"
                  :class="{ 'all-day-event': event.isAllDay }"
                  :style="{
                    backgroundColor: event.bgColor,
                    color: event.textColor || '#ffffff',
                    top: getEventPosition(event).top,
                    height: getEventPosition(event).height
                  }"
                  @click="onEventClick(event)"
                >
                  {{ event.title }}
                  <div v-if="!event.isAllDay" class="event-time">{{ event.time }}</div>
                  <div v-else class="all-day-label">All Day</div>
                  <div v-if="event.location" class="event-location">{{ event.location }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Event Legend -->
    <div v-if="events.length > 0" class="calendar-legend q-mt-sm">
      <div class="text-caption text-grey-6 q-mb-xs">Legend:</div>
      <div class="row q-gutter-sm">
        <div class="legend-item">
          <div class="legend-color" style="background-color: #1976d2"></div>
          <span class="text-caption">{{ props.legendType === 'group' ? 'Group Events' : 'Attending' }}</span>
        </div>
        <div v-if="props.legendType === 'personal'" class="legend-item">
          <div class="legend-color" style="background-color: #2e7d32"></div>
          <span class="text-caption">Hosting</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background-color: #4caf50"></div>
          <span class="text-caption">External Calendar</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background-color: #f44336"></div>
          <span class="text-caption">Cancelled</span>
        </div>
      </div>
    </div>

    <!-- External Events Summary -->
    <div v-if="externalEvents.length > 0 && !compact" class="external-summary q-mt-sm">
      <q-banner rounded class="bg-orange-1 text-orange-9">
        <template v-slot:avatar>
          <q-icon name="sym_r_event" />
        </template>
        {{ externalEvents.length }} external event(s) loaded from connected calendars
      </q-banner>
    </div>
  </div>
</template>

<style scoped lang="scss">
.custom-calendar {
  .calendar-controls {
    .text-h6 {
      min-width: 200px;
      text-align: center;
    }
  }

  .calendar-container {
    position: relative;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    overflow: hidden;
  }

  .month-view {
    display: flex;
    flex-direction: column;

    .week-header {
      display: flex;
      background-color: #f5f5f5;
      border-bottom: 1px solid #e0e0e0;

      .day-header {
        flex: 1;
        padding: 8px;
        text-align: center;
        font-weight: 600;
        color: #666;
        border-right: 1px solid #e0e0e0;

        &:last-child {
          border-right: none;
        }
      }
    }

    .calendar-grid {
      display: flex;
      flex-direction: column;

      .calendar-week {
        display: flex;
        border-bottom: 1px solid #e0e0e0;
        min-height: 80px;

        &:last-child {
          border-bottom: none;
        }

        .calendar-day {
          flex: 1;
          min-width: 0; // Prevent flex items from growing beyond container
          width: calc(100% / 7); // Fixed width for 7 columns
          min-height: 80px;
          border-right: 1px solid #e0e0e0;
          cursor: pointer;
          position: relative;
          padding: 4px;
          background: white;
          overflow: hidden; // Prevent content overflow

          &:last-child {
            border-right: none;
          }

          &:hover {
            background-color: #f0f8ff;
          }

          &.other-month {
            background-color: #fafafa;
            color: #999;
          }

          &.today {
            background-color: #e3f2fd;

            .day-number-container .day-number {
              background-color: #1976d2;
              color: white;
              border-radius: 50%;
              width: 20px;
              height: 20px;
              display: flex;
              align-items: center;
              justify-content: center;
            }
          }

          &.selected {
            background-color: #fff3e0;
            border: 2px solid #ff9800;
            box-shadow: 0 2px 4px rgba(255, 152, 0, 0.2);

            .day-number-container .day-number {
              color: #ff9800;
              font-weight: 700;
            }

            &.today .day-number-container .day-number {
              background-color: #ff9800;
              color: white;
              border-radius: 50%;
              width: 20px;
              height: 20px;
              display: flex;
              align-items: center;
              justify-content: center;
            }
          }

          .day-number-container {
            position: absolute;
            top: 2px;
            left: 2px;
            width: 28px;
            height: 28px;
            cursor: pointer;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background-color 0.2s ease;

            &:hover {
              background-color: rgba(0, 0, 0, 0.1);
            }

            .day-number {
              font-size: 0.75rem;
              font-weight: 600;
              line-height: 1;
            }
          }

          .add-event-btn {
            position: absolute;
            top: 2px;
            right: 2px;
            width: 18px;
            height: 18px;
            cursor: pointer;
            border-radius: 50%;
            background-color: rgba(0, 150, 136, 0.1);
            border: 1px solid rgba(0, 150, 136, 0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0.7;
            transition: all 0.2s ease;

            &:hover {
              opacity: 1;
              background-color: rgba(0, 150, 136, 0.2);
              border-color: rgba(0, 150, 136, 0.5);
              transform: scale(1.1);
            }

            .q-icon {
              color: #00695c;
            }
          }

          .events-container {
            margin-top: 18px;
            padding: 2px;

            .event-bar {
              font-size: 0.65rem;
              padding: 1px 4px;
              margin: 1px 0;
              border-radius: 2px;
              cursor: pointer;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              line-height: 1.2;
              max-width: 100%;
              min-width: 0;

              &:hover {
                opacity: 0.8;
                transform: scale(1.02);
              }
            }

            .more-events {
              font-size: 0.6rem;
              color: #666;
              text-align: center;
              padding: 1px;
            }
          }
        }
      }
    }
  }

  // Week View Styles
  .week-view {
    height: 100%;
    display: flex;
    flex-direction: column;

    .week-header {
      display: flex;
      background-color: #f5f5f5;
      border-bottom: 1px solid #e0e0e0;

      .time-column {
        width: 80px;
        border-right: 1px solid #e0e0e0;
      }

      .day-header {
        flex: 1;
        padding: 8px;
        text-align: center;
        border-right: 1px solid #e0e0e0;
        position: relative;
        transition: background-color 0.2s ease;

        &:hover {
          background-color: #f0f0f0;
        }

        &:last-child {
          border-right: none;
        }

        &.selected {
          background-color: #fff3e0;
          border-bottom: 3px solid #ff9800;

          .day-header-content .day-name {
            color: #ff9800;
          }

          .day-header-content .day-number {
            color: #ff9800;
            font-weight: 700;
          }
        }

        .day-header-content {
          flex: 1;
          cursor: pointer;
          transition: background-color 0.2s ease;

          &:hover {
            background-color: rgba(0, 0, 0, 0.05);
          }
        }

        .day-add-btn {
          position: absolute;
          top: 4px;
          right: 4px;
          width: 16px;
          height: 16px;
          cursor: pointer;
          border-radius: 50%;
          background-color: rgba(0, 150, 136, 0.1);
          border: 1px solid rgba(0, 150, 136, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0.7;
          transition: all 0.2s ease;

          &:hover {
            opacity: 1;
            background-color: rgba(0, 150, 136, 0.2);
            border-color: rgba(0, 150, 136, 0.5);
            transform: scale(1.1);
          }

          .q-icon {
            color: #00695c;
          }
        }

        .day-name {
          font-size: 0.75rem;
          color: #666;
          font-weight: 600;
        }

        .day-number {
          font-size: 1.2rem;
          font-weight: 600;
          margin-top: 2px;

          &.today {
            background-color: #1976d2;
            color: white;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 2px auto 0;
          }
        }
      }
    }

    .week-content {
      flex: 1;
      overflow-y: auto;

      .week-time-grid {
        display: flex;
        height: calc(24 * 50px); // 24 hours * 50px each
        position: relative;

        .time-labels-column {
          width: 80px;
          background-color: #fafafa;
          border-right: 1px solid #e0e0e0;

          .time-label-row {
            height: 50px;
            border-bottom: 1px solid #f0f0f0;
            display: flex;
            align-items: flex-start;
            padding-top: 4px;

            .time-label {
              padding: 0 8px;
              font-size: 0.75rem;
              color: #666;
              text-align: right;
              width: 100%;
            }
          }
        }

        .day-column {
          flex: 1;
          position: relative;
          border-right: 1px solid #f0f0f0;

          &:last-child {
            border-right: none;
          }

          .hour-slot {
            height: 50px;
            border-bottom: 1px solid #f0f0f0;
          }

          .events-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            pointer-events: none;

            .positioned-event {
              position: absolute;
              left: 2px;
              right: 2px;
              background-color: #1976d2;
              color: white;
              padding: 2px 4px;
              border-radius: 2px;
              font-size: 0.7rem;
              cursor: pointer;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              pointer-events: auto;
              z-index: 1;

              .event-time {
                font-size: 0.6rem;
                opacity: 0.9;
              }

              .all-day-label {
                font-size: 0.6rem;
                opacity: 0.9;
                font-style: italic;
              }

              &.all-day-event {
                font-weight: bold;
                border-left: 3px solid rgba(255, 255, 255, 0.5);
                top: 0 !important;
                height: 30px !important;
              }

              &:hover {
                opacity: 0.8;
                z-index: 2;
              }
            }
          }
        }
      }
    }
  }

  // Day View Styles
  .day-view {
    height: 100%;
    display: flex;
    flex-direction: column;

    .day-header-bar {
      background-color: #f5f5f5;
      border-bottom: 1px solid #e0e0e0;
      padding: 16px;

      .day-info {
        text-align: center;

        .day-name {
          font-size: 1.1rem;
          font-weight: 600;
          color: #333;
        }

        .day-number {
          font-size: 2rem;
          font-weight: 600;
          margin-top: 4px;

          &.today {
            color: #1976d2;
          }
        }
      }
    }

    .day-content {
      flex: 1;
      overflow-y: auto;

      .day-time-grid {
        display: flex;
        height: calc(24 * 50px); // 24 hours * 50px each
        position: relative;

        .time-labels-column {
          width: 80px;
          background-color: #fafafa;
          border-right: 1px solid #e0e0e0;

          .time-label-row {
            height: 50px;
            border-bottom: 1px solid #f0f0f0;
            display: flex;
            align-items: flex-start;
            padding-top: 4px;

            .time-label {
              padding: 0 8px;
              font-size: 0.75rem;
              color: #666;
              text-align: right;
              width: 100%;
            }
          }
        }

        .day-column {
          flex: 1;
          position: relative;

          .hour-slot {
            height: 50px;
            border-bottom: 1px solid #f0f0f0;
          }

          .events-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            pointer-events: none;

            .positioned-event {
              position: absolute;
              left: 4px;
              right: 4px;
              background-color: #1976d2;
              color: white;
              padding: 8px;
              border-radius: 4px;
              cursor: pointer;
              word-wrap: break-word;
              pointer-events: auto;
              z-index: 1;

              &.day-event {
                // Day view specific styles
                font-size: 0.9rem;
              }

              .event-time {
                font-size: 0.8rem;
                opacity: 0.9;
                margin-top: 2px;
              }

              .all-day-label {
                font-size: 0.8rem;
                opacity: 0.9;
                font-style: italic;
                margin-top: 2px;
              }

              .event-location {
                font-size: 0.75rem;
                opacity: 0.8;
                margin-top: 2px;
              }

              &.all-day-event {
                font-weight: bold;
                border-left: 4px solid rgba(255, 255, 255, 0.5);
                top: 0 !important;
                height: 40px !important;
              }

              &:hover {
                opacity: 0.8;
                transform: scale(1.02);
                z-index: 2;
              }
            }
          }
        }
      }
    }
  }

  .calendar-legend {
    .legend-item {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .legend-color {
      width: 12px;
      height: 12px;
      border-radius: 2px;
    }
  }
}
</style>
