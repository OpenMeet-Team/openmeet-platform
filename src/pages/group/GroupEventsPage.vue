<template>
  <div class="c-group-events-page">
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
                mode="month"
                height="500px"
                :show-controls="true"
                :group-events="events"
                :external-events="externalEvents"
                legend-type="group"
                @date-select="onDateSelect"
                @event-click="onEventClick"
                @date-click="onDateClick"
              />
            </q-card-section>
          </q-card>

          <!-- Events for selected date -->
          <div v-if="selectedDateEvents.length" class="q-mt-md">
            <q-card>
              <q-card-section>
                <div class="text-h6 q-mb-md">
                  <q-icon name="sym_r_event" class="q-mr-sm" />
                  Events for {{ formatSelectedDate }}
                </div>
                <div class="row q-gutter-md">
                  <div v-for="event in selectedDateEvents" :key="event.id" class="col-12">
                    <!-- Group Event -->
                    <EventsItemComponent
                      v-if="'startDate' in event"
                      :event="event"
                      layout="list"
                    />
                    <!-- External Event (from user's connected calendars) -->
                    <q-card
                      v-else
                      flat
                      class="external-event-card"
                      :class="{ 'external-event--dimmed': true }"
                    >
                      <q-card-section class="q-pa-sm">
                        <div class="row items-center">
                          <q-icon name="sym_r_calendar_month" size="sm" class="q-mr-sm text-grey-6" />
                          <div class="col">
                            <div class="text-body2 text-grey-7">{{ event.summary }}</div>
                            <div class="text-caption text-grey-5">
                              {{ formatEventTime(event.startTime, event.endTime) }}
                              <span v-if="event.location" class="q-ml-sm">• {{ event.location }}</span>
                            </div>
                          </div>
                          <q-chip size="xs" color="grey-4" text-color="grey-7" dense>
                            External
                          </q-chip>
                        </div>
                      </q-card-section>
                    </q-card>
                  </div>
                </div>
              </q-card-section>
            </q-card>
          </div>

          <!-- Hint for calendar interaction -->
          <div v-else-if="!selectedDate" class="q-mt-md">
            <q-banner class="bg-blue-1 text-blue-8" rounded>
              <template v-slot:avatar>
                <q-icon name="sym_r_info" />
              </template>
              Click on a date in the calendar to see events for that day.
              <div v-if="isLoadingExternalEvents" class="q-mt-sm text-caption">
                <q-spinner size="xs" class="q-mr-xs" />
                Loading your calendar events...
              </div>
            </q-banner>
          </div>
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

const viewMode = ref<'list' | 'calendar'>('calendar')
const timeFilter = ref<'upcoming' | 'past'>('upcoming')
const selectedDate = ref<string>('')
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

const selectedDateEvents = computed(() => {
  if (!selectedDate.value) return []

  const selectedDateStr = selectedDate.value
  const groupEvents = events.value?.filter(event => {
    const eventDate = new Date(event.startDate).toISOString().split('T')[0]
    return eventDate === selectedDateStr
  }) || []

  const externalEventsForDate = externalEvents.value.filter(event => {
    const eventDate = new Date(event.startTime).toISOString().split('T')[0]
    return eventDate === selectedDateStr
  })

  // Combine group events and external events
  return [...groupEvents, ...externalEventsForDate]
})

const formatSelectedDate = computed(() => {
  if (!selectedDate.value) return ''
  return new Date(selectedDate.value).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
})

function onDateSelect (date: string) {
  selectedDate.value = date
}

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

function formatEventTime (startTime: string, endTime: string) {
  const start = new Date(startTime)
  const end = new Date(endTime)

  const formatOptions: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }

  return `${start.toLocaleTimeString('en-US', formatOptions)} - ${end.toLocaleTimeString('en-US', formatOptions)}`
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

  .q-banner {
    border-radius: 8px;
  }

  .external-event-card {
    border: 1px solid rgba(0, 0, 0, 0.05);
    background-color: rgba(0, 0, 0, 0.02);
    border-radius: 8px;

    &.external-event--dimmed {
      opacity: 0.7;
    }

    &:hover {
      opacity: 0.9;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
  }
}
</style>
