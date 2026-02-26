<template>
  <div class="c-group-events-page q-pb-xl">
    <SpinnerComponent v-if="isLoading" />
    <div data-cy="group-events-page"
      v-if="!isLoading && group && hasPermission">
      <div class="row q-mb-md q-mt-lg">
        <q-btn-toggle v-model="viewMode" flat stretch toggle-color="primary" :options="[
          { label: 'Calendar', value: 'calendar', icon: 'sym_r_calendar_month' },
          { label: 'List', value: 'list', icon: 'sym_r_list' }
        ]" />
      </div>

      <!-- Time filter only for list view -->
      <div v-if="viewMode === 'list'" class="row q-mb-md">
        <q-btn-toggle v-model="timeFilter" flat stretch toggle-color="primary" :options="[
          { label: 'Upcoming', value: 'upcoming' },
          { label: 'Past', value: 'past' }
        ]" />
      </div>

      <div v-if="viewMode === 'calendar'">
        <div v-if="events?.length">
          <!-- Calendar View -->
          <q-card class="q-mb-lg">
            <q-card-section class="q-pa-none">
              <UnifiedCalendarComponent
                :mode="calendarMode"
                height="500px"
                :show-controls="true"
                :group-events="events"
                :external-events="externalEvents"
                :initial-date="urlDate"
                :initial-view="urlView"
                :scroll-to-hour="urlHour"
                @event-click="onEventClick"
                @date-click="onDateClick"
                @dates-set="onDatesSet"
              />
            </q-card-section>
          </q-card>

        </div>
        <NoContentComponent v-else label="No events found" icon="sym_r_event_busy" />
      </div>

      <div v-else>
        <div v-if="filteredEvents?.length">
          <EventsItemComponent v-for="event in filteredEvents" :key="event.id" :event="event" layout="list"/>
        </div>
        <NoContentComponent v-else label="No events found" icon="sym_r_event_busy" />
      </div>
    </div>
    <NoContentComponent data-cy="no-permission-group-events-page" v-if="!isLoading && group && !hasPermission" label="You don't have permission to see this page" icon="sym_r_group" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import UnifiedCalendarComponent from '../../components/calendar/UnifiedCalendarComponent.vue'
import SpinnerComponent from '../../components/common/SpinnerComponent.vue'
import NoContentComponent from '../../components/global/NoContentComponent.vue'
import { useRoute, useRouter } from 'vue-router'
import { useGroupStore } from '../../stores/group-store'
import { GroupPermission } from '../../types'
import { useAuthStore } from '../../stores/auth-store'
import EventsItemComponent from '../../components/event/EventsItemComponent.vue'
import { getExternalEvents, type ExternalEvent, type GetExternalEventsRequest } from '../../api/calendar'

const route = useRoute()
const router = useRouter()
const isLoading = ref<boolean>(false)
const isLoadingExternalEvents = ref<boolean>(false)
const events = computed(() => useGroupStore().group?.events)
const externalEvents = ref<ExternalEvent[]>([])

const validViews = ['month', 'week', 'day'] as const
type CalendarViewMode = typeof validViews[number]

// Read URL query params for calendar deep linking
const urlDate = computed(() => {
  const d = route.query.date
  return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined
})

const urlView = computed((): CalendarViewMode | undefined => {
  const v = route.query.view
  if (typeof v === 'string' && validViews.includes(v as CalendarViewMode)) {
    return v as CalendarViewMode
  }
  return undefined
})

const urlHour = computed((): number | undefined => {
  const h = route.query.hour
  if (typeof h === 'string') {
    const num = parseInt(h, 10)
    if (!isNaN(num) && num >= 0 && num <= 23) return num
  }
  return undefined
})

// The calendar mode comes from the URL view param, defaulting to 'month'
const calendarMode = computed((): CalendarViewMode => urlView.value || 'month')

const viewMode = ref<'list' | 'calendar'>('calendar')
const timeFilter = ref<'upcoming' | 'past'>('upcoming')
const group = computed(() => useGroupStore().group)

const hasPermission = computed(() => {
  return group.value && ((useGroupStore().getterIsPublicGroup || (useGroupStore().getterIsAuthenticatedGroup && useAuthStore().isAuthenticated)) ||
    useGroupStore().getterUserHasPermission(GroupPermission.SeeEvents))
})

const loadExternalEvents = async () => {
  if (!useAuthStore().isAuthenticated) return

  try {
    isLoadingExternalEvents.value = true

    // Get events for the current month
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    const request: GetExternalEventsRequest = {
      startTime: startOfMonth.toISOString(),
      endTime: endOfMonth.toISOString()
    }

    const response = await getExternalEvents(request)
    externalEvents.value = response.data.events
  } catch (error) {
    console.error('Failed to load external events:', error)
    // Don't show error to user - external events are supplementary
  } finally {
    isLoadingExternalEvents.value = false
  }
}

const loadGroupEvents = async (groupSlug: string) => {
  if (hasPermission.value) {
    isLoading.value = true
    try {
      await useGroupStore().actionGetGroupEvents(groupSlug)
      // Load external events in parallel if user is authenticated
      if (useAuthStore().isAuthenticated) {
        loadExternalEvents()
      }
    } finally {
      isLoading.value = false
    }
  }
}

onMounted(async () => {
  await loadGroupEvents(route.params.slug as string)
})

// Watch for route changes to reload events when switching groups
watch(() => route.params.slug, async (newSlug, oldSlug) => {
  if (newSlug && newSlug !== oldSlug) {
    await loadGroupEvents(newSlug as string)
  }
})

const filteredEvents = computed(() => {
  const now = new Date()
  const filtered = events.value?.filter(event => {
    // Use full date+time comparison instead of just date
    const eventDateTime = new Date(event.startDate)
    return timeFilter.value === 'upcoming' ? eventDateTime >= now : eventDateTime < now
  }) || []

  // Sort events by date (ascending for upcoming, descending for past)
  return [...filtered].sort((a, b) => {
    const dateA = new Date(a.startDate).getTime()
    const dateB = new Date(b.startDate).getTime()
    return timeFilter.value === 'upcoming' ? dateA - dateB : dateB - dateA
  })
})

function onEventClick (event: { slug?: string }) {
  // If the event has a slug, navigate to the event page
  if (event.slug) {
    window.open(`/events/${event.slug}`, '_blank')
  }
}

function onDateClick (date: string) {
  // Navigate to create event page with pre-filled date and group
  const groupSlug = route.params.slug as string
  router.push({
    path: '/dashboard/events/create',
    query: {
      date,
      groupSlug
    }
  })
}

// Reverse map: FullCalendar view type -> user-friendly name
const reverseViewMap: Record<string, string> = {
  dayGridMonth: 'month',
  timeGridWeek: 'week',
  timeGridDay: 'day',
  listWeek: 'week'
}

function onDatesSet (info: { startStr: string; endStr: string; view: { type: string; currentStart: Date } }) {
  // Use toISOString for UTC-safe date formatting (getDate() uses local timezone)
  const dateStr = info.view.currentStart.toISOString().split('T')[0]
  const friendlyView = reverseViewMap[info.view.type] || info.view.type

  const query: Record<string, string> = {
    ...route.query as Record<string, string>,
    date: dateStr,
    view: friendlyView
  }

  if (friendlyView === 'week' || friendlyView === 'day') {
    query.hour = String(new Date().getHours())
  } else {
    delete query.hour
  }

  router.replace({ query })
}
</script>

<style scoped lang="scss">
.c-group-events-page {
  .q-card {
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

    &:hover {
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    }
  }

}
</style>
