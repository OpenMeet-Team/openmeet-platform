<script setup lang="ts">
import { ref, computed, toRef, watch, onMounted, onUnmounted } from 'vue'
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import luxon3Plugin from '@fullcalendar/luxon3'
import type { EventClickArg, CalendarOptions } from '@fullcalendar/core'
import type { DateClickArg } from '@fullcalendar/interaction'
import { useAuthStore } from '../../stores/auth-store'
import { useCalendarEventSources } from '../../composables/useCalendarEventSources'
import { type CalendarEvent } from '../../composables/useCalendarEventMapping'

interface Props {
  mode?: 'month' | 'week' | 'day'
  height?: string
  showControls?: boolean
  compact?: boolean
  startDate?: string
  endDate?: string
  groupSlug?: string
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
  datesSet: [info: DatesSetInfo]
  viewChange: [viewType: string]
}>()

const authStore = useAuthStore()

// eventSources: FullCalendar calls these callbacks on every date navigation
const { personalEventsSource, externalEventsSource, groupEventsSource, mergedGroupSource } =
  useCalendarEventSources(toRef(props, 'groupSlug'))

const eventSources = computed(() => {
  const sources = []

  // When viewing a group calendar, use a single merged source that handles
  // dedup, RSVP enrichment, and context events in one pass
  if (mergedGroupSource.value) {
    sources.push(mergedGroupSource.value)
    return sources
  }

  // Personal calendar: separate sources (no dedup needed)
  if (authStore.user) {
    sources.push(personalEventsSource)
    sources.push(externalEventsSource)
  }
  if (groupEventsSource.value) {
    sources.push(groupEventsSource.value)
  }
  return sources
})

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
    // eventSources managed imperatively via calendar API (see onMounted/watch below)
    // to preserve FullCalendar's lazyFetching cache across option recomputations
    eventClick: handleEventClick,
    dateClick: handleDateClick,
    datesSet: handleDatesSet,
    editable: false,
    selectable: false,
    dayMaxEvents: 4,
    nowIndicator: true,
    // Render cached events immediately instead of waiting for all sources to resolve
    progressiveEventRendering: true
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

// Sync event sources imperatively so FullCalendar's lazyFetching cache
// survives calendarOptions recomputations (view changes, resize, etc.)
// Uses ID-based diffing to only add/remove changed sources, preserving cache.
function syncEventSources () {
  const api = calendarRef.value?.getApi()
  if (!api) return

  const newIds = new Set(eventSources.value.map(s => (s as { id?: string }).id))

  // Remove sources no longer present
  for (const source of api.getEventSources()) {
    if (!newIds.has(source.id)) {
      source.remove()
    }
  }

  // Add sources that aren't already registered
  const existingIds = new Set(api.getEventSources().map(s => s.id))
  for (const source of eventSources.value) {
    if (!existingIds.has((source as { id?: string }).id)) {
      api.addEventSource(source)
    }
  }
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', handleResize)
  }
  // Add event sources after FullCalendar has initialized
  syncEventSources()
})

// Re-sync when sources change (auth state change, groupSlug change)
watch(eventSources, () => syncEventSources())

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

// Light mode — use OpenMeet purple palette for controls
.body--light .fc {
  --fc-border-color: #e0e0e0;
  --fc-today-bg-color: rgba(238, 237, 251, 0.5); // purple-100 at 50%
  --fc-now-indicator-color: #7B71DA; // purple-400
}

.body--light .fc .fc-button {
  background-color: #EEEDFB; // purple-100
  border-color: #D2ACEE; // purple-200
  color: #4238A6; // purple-500
  font-weight: 500;

  &:hover {
    background-color: #D2ACEE; // purple-200
    border-color: #AF9EE8; // purple-300
    color: #1E1A43; // purple-600
  }

  &:focus {
    box-shadow: 0 0 0 0.2rem rgba(123, 113, 218, 0.25); // purple-400 glow
  }

  &.fc-button-active {
    background-color: #7B71DA; // purple-400
    border-color: #7B71DA;
    color: #ffffff;
  }
}

.body--light .fc .fc-toolbar-title {
  color: #4238A6; // purple-500
}

.body--light .fc .fc-col-header-cell-cushion {
  color: #4238A6; // purple-500
}

.body--light .fc .fc-daygrid-day-number {
  color: #333333;
}

.body--light .fc .fc-day-today .fc-daygrid-day-number {
  color: #7B71DA; // purple-400
  font-weight: 700;
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

// Faded context events: personal non-group events shown on group calendar
// for schedule awareness without competing with group events
.fc .calendar-event-context {
  opacity: 0.45;
}

</style>
