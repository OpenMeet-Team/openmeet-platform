<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import luxon3Plugin from '@fullcalendar/luxon3'
import type { EventInput, EventClickArg, CalendarOptions } from '@fullcalendar/core'
import type { DateClickArg } from '@fullcalendar/interaction'
import { getExternalEvents, type ExternalEvent } from '../../api/calendar'
import { useAuthStore } from '../../stores/auth-store'
import { useHomeStore } from '../../stores/home-store'
import { useDashboardStore } from '../../stores/dashboard-store'
import { EventAttendeeStatus } from '../../types/event'
import {
  mapGroupEvent,
  mapExternalEvent,
  mapPersonalAttendingEvent,
  mapPersonalHostingEvent,
  deduplicateEvents,
  type GroupEvent,
  type CalendarEvent
} from '../../composables/useCalendarEventMapping'

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
  initialDate?: string
  initialView?: 'month' | 'week' | 'day'
  scrollToHour?: number
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

interface DatesSetInfo {
  startStr: string
  endStr: string
  view: { type: string; currentStart: Date }
}

const emit = defineEmits<{
  eventClick: [event: CalendarEvent]
  dateClick: [date: string]
  dateSelect: [date: string]
  externalEventsLoaded: [events: ExternalEvent[]]
  datesSet: [info: DatesSetInfo]
  viewChange: [viewType: string]
}>()

const authStore = useAuthStore()
const homeStore = useHomeStore()
const dashboardStore = useDashboardStore()

const calendarRef = ref<InstanceType<typeof FullCalendar>>()

// View mode mapping
const viewMap: Record<string, string> = {
  month: 'dayGridMonth',
  week: 'timeGridWeek',
  day: 'timeGridDay'
}

// Reverse map: FullCalendar view type -> user-friendly name
const reverseViewMap: Record<string, string> = {
  dayGridMonth: 'month',
  timeGridWeek: 'week',
  timeGridDay: 'day',
  listWeek: 'week'
}

// Personal events split: core (attending/hosting) loaded once, external reloaded on navigation
const personalCoreEvents = ref<EventInput[]>([])
const personalExternalEvents = ref<EventInput[]>([])

// Track visible date range for external event refetching
const visibleRange = ref<{ start: string; end: string } | null>(null)

// Map group events from props
const groupCalendarEvents = computed<EventInput[]>(() => {
  if (!props.groupEvents?.length) return []
  return props.groupEvents.map(mapGroupEvent)
})

// Map external events from props
const externalCalendarEvents = computed<EventInput[]>(() => {
  if (!props.externalEvents?.length) return []
  return props.externalEvents.map(mapExternalEvent)
})

// All events combined and deduplicated
const allEvents = computed<EventInput[]>(() => {
  const combined = [
    ...groupCalendarEvents.value,
    ...personalCoreEvents.value,
    ...personalExternalEvents.value,
    ...externalCalendarEvents.value
  ]
  return deduplicateEvents(combined)
})

// Responsive view switching
function getResponsiveView (): string {
  if (typeof window !== 'undefined' && window.innerWidth < 768) return 'listWeek'
  // initialView takes priority over mode
  const viewKey = props.initialView || props.mode || 'month'
  return viewMap[viewKey]
}

const isMobile = ref(typeof window !== 'undefined' && window.innerWidth < 768)
const currentView = ref(getResponsiveView())

function handleResize () {
  isMobile.value = typeof window !== 'undefined' && window.innerWidth < 768
  const newView = getResponsiveView()
  if (newView !== currentView.value) {
    currentView.value = newView
    const api = calendarRef.value?.getApi()
    if (api) {
      api.changeView(newView)
    }
  }
}

// Date picker for jumping to any date
const datePickerRef = ref<HTMLInputElement>()

function openDatePicker () {
  datePickerRef.value?.showPicker()
}

function onDatePickerChange (event: Event) {
  const input = event.target as HTMLInputElement
  if (input.value) {
    const api = calendarRef.value?.getApi()
    if (api) {
      api.gotoDate(input.value)
    }
  }
}

// Click handlers
function handleEventClick (info: EventClickArg) {
  info.jsEvent.preventDefault()
  const event = info.event
  emit('eventClick', {
    id: event.id,
    title: event.title,
    slug: event.extendedProps.slug,
    type: event.extendedProps.type === 'external-event' ? 'external-conflict' : event.extendedProps.type,
    groupSlug: event.extendedProps.groupSlug
  })
}

function handleDateClick (info: DateClickArg) {
  const dateStr = info.dateStr.split('T')[0] // YYYY-MM-DD
  emit('dateClick', dateStr)
  emit('dateSelect', dateStr)
}

// Track last emitted view type to avoid duplicate viewChange emissions
let lastEmittedViewType = ''

function handleDatesSet (info: DatesSetInfo) {
  emit('datesSet', info)

  // Track visible range — triggers external events reload via watcher
  visibleRange.value = { start: info.startStr, end: info.endStr }

  // Emit viewChange only when the view type actually changes
  const friendlyView = reverseViewMap[info.view.type] || info.view.type
  if (friendlyView !== lastEmittedViewType) {
    lastEmittedViewType = friendlyView
    emit('viewChange', friendlyView)
  }
}

// Calendar options
const calendarOptions = computed<CalendarOptions>(() => {
  const opts: CalendarOptions = {
    plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin, luxon3Plugin],
    initialView: currentView.value,
    // Month view: auto height so cells grow to fit events
    // Week/day views: fixed height for scrollable time grid
    height: currentView.value === 'dayGridMonth' ? 'auto' : (props.height || '500px'),
    timeZone: 'local',
    headerToolbar: props.showControls
      ? isMobile.value
        ? {
            start: 'title',
            center: '',
            end: 'jumpToDate prev,next'
          }
        : {
            start: 'prev,next today jumpToDate',
            center: 'title',
            end: 'dayGridMonth,timeGridWeek,timeGridDay'
          }
      : false,
    customButtons: {
      jumpToDate: {
        text: '\uD83D\uDCC5',
        hint: 'Jump to date',
        click: openDatePicker
      }
    },
    // Use text buttons — the fcicons font doesn't render reliably in dark themes
    buttonIcons: false,
    buttonText: {
      prev: '\u25C0',
      next: '\u25B6',
      today: 'today'
    },
    // Show events as colored bars (not dots) in month view
    eventDisplay: 'block',
    events: allEvents.value,
    eventClick: handleEventClick,
    dateClick: handleDateClick,
    datesSet: handleDatesSet,
    editable: false,
    selectable: false,
    dayMaxEvents: 4,
    nowIndicator: true
  }

  // Scroll to specific hour after FullCalendar's view DOM is fully rendered
  if (props.scrollToHour != null) {
    opts.viewDidMount = (info: { view: { type: string; calendar: { scrollToTime: (time: string) => void } } }) => {
      const viewType = info.view.type
      if (viewType === 'timeGridWeek' || viewType === 'timeGridDay') {
        const hour = String(props.scrollToHour).padStart(2, '0')
        info.view.calendar.scrollToTime(`${hour}:00:00`)
      }
    }
  }

  // Only set initialDate if provided (otherwise let FullCalendar default to today)
  if (props.initialDate) {
    opts.initialDate = props.initialDate
  }

  return opts
})

// Load core personal events (attending + hosting) — called once at mount
async function loadPersonalCoreEvents () {
  if (props.groupEvents?.length) return
  if (!authStore.user) return

  const events: EventInput[] = []

  try {
    // Load attending events from home store
    if (!homeStore.userUpcomingEvents?.length) {
      await homeStore.actionGetUserHomeState()
    }
    const upcomingEvents = homeStore.userUpcomingEvents || []

    // Filter out cancelled RSVPs
    const filteredAttending = upcomingEvents.filter((event: { attendee?: { status: string } }) => {
      return !event.attendee || event.attendee.status !== EventAttendeeStatus.Cancelled
    })

    for (const event of filteredAttending) {
      events.push(mapPersonalAttendingEvent(event))
    }

    // Load hosting events from dashboard store
    if (!dashboardStore.events) {
      await dashboardStore.actionGetDashboardEvents()
    }
    const hostedEvents = dashboardStore.events || []

    for (const event of hostedEvents) {
      events.push(mapPersonalHostingEvent(event))
    }
  } catch {
    console.warn('Failed to load personal calendar events')
  }

  personalCoreEvents.value = events
}

// Load external events for a date range — called on navigation
async function loadExternalEventsForRange (startStr: string, endStr: string) {
  if (props.groupEvents?.length) return
  if (!authStore.user) return

  try {
    const externalResponse = await getExternalEvents({
      startTime: startStr.includes('T') ? startStr : `${startStr}T00:00:00Z`,
      endTime: endStr.includes('T') ? endStr : `${endStr}T23:59:59Z`
    })

    const externalEventsData = externalResponse.data.events || []
    const mapped: EventInput[] = []
    for (const ext of externalEventsData) {
      mapped.push(mapExternalEvent(ext))
    }
    personalExternalEvents.value = mapped

    if (externalEventsData.length > 0) {
      emit('externalEventsLoaded', externalEventsData)
    }
  } catch {
    console.warn('Failed to load external calendar events')
  }
}

// Reload external events when visible date range changes
watch(visibleRange, (range) => {
  if (range) {
    loadExternalEventsForRange(range.start, range.end)
  }
})

// Watch for group events changes
watch(
  () => props.groupEvents,
  () => {
    if (!props.groupEvents?.length) {
      loadPersonalCoreEvents()
    }
  }
)

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', handleResize)
  }
  loadPersonalCoreEvents()
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', handleResize)
  }
})
</script>

<template>
  <div class="unified-calendar q-pa-sm">
    <input
      ref="datePickerRef"
      type="date"
      class="calendar-date-picker"
      @change="onDatePickerChange"
    >
    <FullCalendar ref="calendarRef" :options="calendarOptions" />
  </div>
</template>

<style lang="scss">
// Hidden date picker — opened programmatically via the toolbar button
.calendar-date-picker {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  pointer-events: none;
}

// Compact toolbar on mobile
@media (max-width: 767px) {
  .fc .fc-toolbar {
    flex-wrap: nowrap;
    gap: 4px;
  }

  .fc .fc-toolbar-title {
    font-size: 1.1rem;
  }

  .fc .fc-header-toolbar {
    margin-bottom: 0.5em;
  }
}

// Dark mode CSS variables for FullCalendar
.body--dark .fc {
  --fc-border-color: rgba(255, 255, 255, 0.12);
  --fc-page-bg-color: transparent;
  --fc-neutral-bg-color: rgba(255, 255, 255, 0.05);
  --fc-list-event-hover-bg-color: rgba(255, 255, 255, 0.08);
  --fc-today-bg-color: rgba(25, 118, 210, 0.1);
  --fc-now-indicator-color: #1976d2;
}

.body--dark .fc .fc-col-header-cell-cushion,
.body--dark .fc .fc-daygrid-day-number {
  color: rgba(255, 255, 255, 0.87);
}

.body--dark .fc .fc-timegrid-slot-label-cushion,
.body--dark .fc .fc-list-day-cushion {
  color: rgba(255, 255, 255, 0.7);
}

.body--dark .fc .fc-button {
  background-color: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.87);

  &:hover {
    background-color: rgba(255, 255, 255, 0.15);
  }

  &.fc-button-active {
    background-color: #1976d2;
    border-color: #1976d2;
  }
}

.body--dark .fc .fc-toolbar-title {
  color: rgba(255, 255, 255, 0.87);
}

// Event styling — ensure events are readable in dark mode
.fc .fc-daygrid-event {
  border-radius: 3px;
  padding: 1px 3px;
  font-size: 0.8rem;
  cursor: pointer;
}

</style>
