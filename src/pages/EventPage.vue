<template>
  <q-page padding style="max-width: 1201px" class="q-mx-auto c-event-page">
    <SpinnerComponent v-if="useEventStore().isLoading" />
    <div v-else-if="event" class="row q-col-gutter-md">
      <div class="col-8">
        <q-card>
          <q-img data-cy="event-image" :src="getImageSrc(event.image)" />
        </q-card>

        <!-- Event actions -->
        <q-card class="q-mt-md">
          <q-card-section>
            <div class="row items-center justify-between">
              <div class="col-12 col-sm-6">
                <div class="text-body2 text-bold">
                  <template v-if="isTemplateView && templateDate">
                    <q-badge color="blue" class="q-mr-sm">Template View</q-badge>
                    {{ formatDate(templateDate) }}
                  </template>
                  <template v-else>
                    {{ formatDate(event.startDate) }}
                  </template>
                </div>
                <span v-if="event.maxAttendees">
                  <span class="text-red">{{
                    spotsLeft > 0
                      ? `${spotsLeft} ${pluralize(spotsLeft, "spot")} left`
                      : "No spots left"
                  }}</span>
                </span>
                <div class="text-h6 text-bold">{{ event.name }}</div>
                <div v-if="isTemplateView" class="text-caption text-blue">
                  <q-icon name="sym_r_info" size="xs" class="q-mr-xs" />
                  This is a future occurrence of this event. Editing or adding attendees will create a scheduled event.
                </div>
              </div>
              <!-- Attendance status -->
              <div class="col-12 col-sm-6 row q-gutter-md justify-end no-wrap">
                <div
                  class="column"
                  v-if="useEventStore().getterUserIsAttendee()"
                >
                  <div
                    data-cy="event-attendee-status-confirmed"
                    class="text-subtitle1 text-bold"
                    v-if="
                      event.attendee?.status === EventAttendeeStatus.Confirmed
                    "
                  >
                    You're going!
                  </div>
                  <div
                    data-cy="event-attendee-status-pending"
                    class="text-subtitle1 text-bold"
                    v-if="
                      event.attendee?.status === EventAttendeeStatus.Pending
                    "
                  >
                    You're pending approval!
                  </div>
                  <div
                    data-cy="event-attendee-status-waitlist"
                    class="text-subtitle1 text-bold"
                    v-if="
                      event.attendee?.status === EventAttendeeStatus.Waitlist
                    "
                  >
                    You're on the waitlist!
                  </div>
                  <div
                    data-cy="event-attendee-status-rejected"
                    class="text-subtitle1 text-bold"
                    v-if="
                      event.attendee?.status === EventAttendeeStatus.Rejected
                    "
                  >
                    You're rejected!
                  </div>
                  <div
                    data-cy="event-attendee-status-cancelled"
                    class="text-subtitle1 text-bold"
                    v-if="
                      event.attendee?.status === EventAttendeeStatus.Cancelled
                    "
                  >
                    You're cancelled!
                  </div>
                </div>
                <div class="row items-start q-gutter-md">
                  <!-- Share button -->
                  <ShareComponent class="col-4" />

                  <!-- Attend button -->
                  <EventAttendanceButton
                    :event="event"
                    :attendee="event.attendee"
                    :is-template-view="isTemplateView"
                    :template-date="templateDate"
                  />

                  <QRCodeComponent class="" />
                </div>
              </div>
            </div>
          </q-card-section>
        </q-card>

        <EventAttendeesComponent />
        <EventTopicsComponent />
      </div>
      <div class="col-12 col-md-4">
        <div>
          <!-- Organiser tools -->
          <q-card
            class="q-mb-md shadow-0"
            v-if="
              useEventStore().getterGroupMemberHasPermission(
                GroupPermission.ManageEvents
              ) ||
              useEventStore().getterUserHasPermission(
                EventAttendeePermission.ManageEvent
              ) ||
              isOwnerOrAdmin
            "
          >
            <q-card-section>
              <span
                class="text-overline"
                v-if="event.status === EventStatus.Draft"
                >{{ event.status }}</span
              >
              <q-btn-dropdown
                data-cy="organiser-tools"
                ripple
                flat
                align="center"
                no-caps
                label="Organiser tools"
              >
                <q-list>
                  <MenuItemComponent
                    label="Edit event"
                    icon="sym_r_edit_note"
                    v-if="
                      useEventStore().getterUserHasPermission(
                        EventAttendeePermission.ManageEvent
                      ) ||
                      isOwnerOrAdmin
                    "
                    @click="handleEditEvent"
                  />
                  <MenuItemComponent
                    label="Manage attendees"
                    icon="sym_r_people"
                    v-if="
                      useEventStore().getterUserHasPermission(
                        EventAttendeePermission.ManageAttendees
                      )
                    "
                    @click="router.push({ name: 'EventAttendeesPage' })"
                  />
                  <MenuItemComponent
                    v-if="
                      event.status === EventStatus.Published &&
                      useEventStore().getterUserHasPermission(
                        EventAttendeePermission.CancelEvent
                      )
                    "
                    label="Cancel event"
                    icon="sym_r_event_busy"
                    @click="onCancelEvent"
                  />

                  <!-- We're keeping only the future events component and pointer to series, so removing management options -->
                  <q-separator />
                  <MenuItemComponent
                    label="Delete event"
                    v-if="
                      useEventStore().getterUserHasPermission(
                        EventAttendeePermission.DeleteEvent
                      ) ||
                      isOwnerOrAdmin
                    "
                    icon="sym_r_delete"
                    @click="onDeleteEvent"
                  />
                </q-list>
              </q-btn-dropdown>
            </q-card-section>
          </q-card>

          <!-- Organiser section -->
          <q-card v-if="event?.group">
            <q-card-section>
              <div class="text-h6">Organizer</div>
              <div class="q-mt-md">
                <q-item clickable @click="navigateToGroup(event.group)">
                  <q-item-section avatar>
                    <q-avatar size="48px">
                      <img
                        v-if="event.group.image"
                        :src="getImageSrc(event.group.image)"
                        :alt="event.group.name"
                      />
                      <q-icon v-else name="sym_r_group" />
                    </q-avatar>
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ event.group.name }}</q-item-label>
                    <q-item-label caption
                      >{{ event.group.visibility }} group</q-item-label
                    >
                  </q-item-section>
                </q-item>
              </div>
            </q-card-section>
          </q-card>

          <!-- Details section -->
          <q-card class="q-mb-lg">
            <q-card-section>
              <!-- Title -->
              <div
                data-cy="event-name"
                :class="[Dark.isActive ? 'bg-dark' : 'bg-white']"
                class="text-h4 text-bold bg-inherit q-py-sm"
              >
                {{ event.name }}
              </div>
              <!-- Series Information -->
              <div v-if="event.seriesSlug" class="q-mb-md">
                <q-badge color="primary" class="q-mb-sm">Part of a Series</q-badge>
                <div class="text-h6 text-bold">{{ event.series?.name }}</div>
                <div class="text-body2 q-mt-sm">{{ event.series?.description }}</div>
              </div>
              <q-card-section>
                <div
                  data-cy="event-description"
                  class="text-body1 q-mt-md bio-content"
                >
                  <q-markdown v-if="event.description" :src="event.description" />
                  <div v-else class="text-grey-6 text-italic">No description provided</div>
                </div>
              </q-card-section>
            </q-card-section>
            <q-card-section>
              <!-- Lead block -->
              <EventLeadComponent />
            </q-card-section>
            <q-card-section>
              <q-item>
                <q-item-section side>
                  <q-icon name="sym_r_schedule" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ formatDate(event.startDate) }}</q-item-label>
                  <q-item-label v-if="event.endDate">{{
                    formatDate(event.endDate)
                  }}</q-item-label>
                  <q-item-label v-if="event.timeZone" caption>
                    {{ event.timeZone }}
                  </q-item-label>
                </q-item-section>
              </q-item>

              <!-- Recurrence information -->
              <RecurrenceDisplayComponent v-if="event.isRecurring" :event="event" />

              <!-- Enhanced Recurrence Display - Not hidden in expansion panel -->
              <q-item v-if="event.seriesSlug" class="q-mt-md series-occurrences">
                <q-item-section>
                  <q-item-label class="text-weight-medium q-mb-sm">Upcoming Occurrences</q-item-label>

                  <q-list bordered separator class="rounded-borders">
                    <q-item
                      v-for="(occurrence, index) in upcomingOccurrences"
                      :key="index"
                      @click="occurrence.eventSlug ? navigateToEvent(occurrence.eventSlug) : handleUnmaterializedEvent(occurrence)"
                      clickable
                      v-ripple
                      :class="[occurrence.eventSlug ? 'scheduled-event' : 'potential-event']"
                    >
                      <q-item-section avatar>
                        <q-avatar size="28px" color="primary" text-color="white">
                          {{ index + 1 }}
                        </q-avatar>
                      </q-item-section>
                      <q-item-section>
                        <q-item-label>{{ formatDate(occurrence.date) }}</q-item-label>
                        <q-item-label caption v-if="occurrence.eventSlug" class="text-positive">
                          <q-icon name="sym_r_check_circle" size="xs" class="q-mr-xs" />Scheduled event
                        </q-item-label>
                        <q-item-label caption v-else class="text-grey-7">
                          <q-icon name="sym_r_today" size="xs" class="q-mr-xs" />Potential event
                        </q-item-label>
                      </q-item-section>
                      <q-item-section side>
                        <q-icon
                          :name="occurrence.eventSlug ? 'sym_r_arrow_forward' : 'sym_r_event_available'"
                          :color="occurrence.eventSlug ? 'primary' : 'grey-7'"
                        />
                      </q-item-section>
                    </q-item>

                    <q-item v-if="upcomingOccurrences.length === 0">
                      <q-item-section>
                        <q-item-label>No upcoming occurrences found</q-item-label>
                      </q-item-section>
                    </q-item>
                  </q-list>

                  <div class="text-right q-mt-sm">
                    <q-btn
                      flat
                      color="primary"
                      label="View Series"
                      @click="navigateToEventSeries"
                      icon-right="sym_r_arrow_forward"
                    />
                  </div>
                </q-item-section>
              </q-item>

              <!-- Regular Recurrence Display Component (if event doesn't have seriesSlug) -->
              <RecurrenceDisplayComponent v-else-if="event.isRecurring" :event="event" />

              <q-item>
                <q-item-section side>
                  <q-icon
                    label="In person"
                    v-if="event.type === 'in-person'"
                    icon="sym_r_person_pin_circle"
                    name="sym_r_person_pin_circle"
                  />
                  <q-icon
                    label="Online"
                    v-if="event.type === 'online'"
                    name="sym_r_videocam"
                  />
                  <q-icon
                    label="Hybrid"
                    v-if="event.type === 'hybrid'"
                    name="sym_r_diversity_2"
                  />
                </q-item-section>
                <q-item-section>
                  <div class="row items-center">
                    <q-item-label>{{ event.type }} event</q-item-label>
                    <q-badge
                      v-if="event.sourceType"
                      :color="getSourceColor(event.sourceType)"
                      class="q-ml-sm"
                    >
                      <q-icon
                        v-if="event.sourceType === 'bluesky'"
                        name="fa-brands fa-bluesky"
                        size="xs"
                        class="q-mr-xs"
                      />
                      {{ event.sourceType }}
                    </q-badge>
                  </div>
                  <q-btn
                    no-caps
                    size="md"
                    align="left"
                    flat
                    padding="none"
                    target="_blank"
                    :href="event.locationOnline"
                    class="text-underline text-blue"
                    >Online link
                  </q-btn>
                  <q-item-label class="cursor-pointer text-underline text-blue">
                    {{ event.location }}
                    <q-popup-proxy>
                      <q-card
                        class="q-pa-md"
                        style="height: 500px; width: 500px"
                      >
                        <LeafletMapComponent
                          disabled
                          style="height: 450px; width: 450px"
                          :lat="event.lat"
                          :lon="event.lon"
                        />
                      </q-card>
                    </q-popup-proxy>
                  </q-item-label>
                </q-item-section>
              </q-item>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>

    <NoContentComponent
      data-cy="event-not-found"
      v-if="errorMessage"
      label="Event not found"
      icon="sym_r_error"
      @click="router.push({ name: 'EventsPage' })"
      button-label="Go to events"
    />

    <template v-if="!errorMessage">
      <q-separator class="q-my-lg" />

      <!-- Remove bottom margin by adding q-mb-none -->
      <div
        class="bg-purple-100 q-py-xl q-mb-none"
        style="
          width: 100vw;
          position: relative;
          left: 50%;
          right: 50%;
          margin-left: -50vw;
          margin-right: -50vw;
        "
      >
        <div class="q-mx-auto" style="max-width: 1201px; padding: 0 24px">
          <EventsListComponent
            data-cy="similar-events-component"
            label="Similar Events"
            :events="similarEvents"
            :loading="similarEventsLoading"
            :hide-link="true"
            layout="list"
          />
        </div>
      </div>
    </template>

    <!-- We're keeping only the future events component and pointer to series, so removing the management dialogs -->
  </q-page>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter, onBeforeRouteUpdate } from 'vue-router'
import { Dark, LoadingBar, useMeta, useQuasar } from 'quasar'
import { getImageSrc } from '../utils/imageUtils'
import { eventsApi } from '../api/events'
import { formatDate } from '../utils/dateUtils'
import LeafletMapComponent from '../components/common/LeafletMapComponent.vue'
import MenuItemComponent from '../components/common/MenuItemComponent.vue'
import { useEventDialog } from '../composables/useEventDialog'
import EventLeadComponent from '../components/event/EventLeadComponent.vue'
import { useEventStore } from '../stores/event-store'
import SpinnerComponent from '../components/common/SpinnerComponent.vue'
import NoContentComponent from '../components/global/NoContentComponent.vue'
import { useNavigation } from '../composables/useNavigation'
import EventsListComponent from '../components/event/EventsListComponent.vue'
import { GroupPermission } from '../types/group'
import { EventAttendeePermission, EventStatus, EventType } from '../types/event'
import EventAttendeesComponent from '../components/event/EventAttendeesComponent.vue'
import EventTopicsComponent from '../components/event/EventTopicsComponent.vue'
import {
  EventEntity,
  EventAttendeeStatus
} from '../types'
import { pluralize } from '../utils/stringUtils'
import ShareComponent from '../components/common/ShareComponent.vue'
import QRCodeComponent from '../components/common/QRCodeComponent.vue'
import EventAttendanceButton from '../components/event/EventAttendanceButton.vue'
import { getSourceColor } from '../utils/eventUtils'
import RecurrenceDisplayComponent from '../components/event/RecurrenceDisplayComponent.vue'
import { useAuthSession } from '../boot/auth-session'
import { EventSeriesService } from '../services/eventSeriesService'
import { useAuthStore } from '../stores/auth-store'
import { RecurrenceService } from '../services/recurrenceService'

// Define global window property
declare global {
  interface Window {
    lastEventPageLoad?: Record<string, number>;
  }
}

const route = useRoute()
const router = useRouter()
const $q = useQuasar()
const { navigateToGroup } = useNavigation()
const { openDeleteEventDialog, openCancelEventDialog } = useEventDialog()
const event = computed(() => useEventStore().event)
const errorMessage = computed(() => useEventStore().errorMessage)
const similarEvents = ref<EventEntity[]>([])
const similarEventsLoading = ref(false)
const upcomingOccurrences = ref([])

const onDeleteEvent = () => {
  if (event.value) openDeleteEventDialog(event.value)
}

const onCancelEvent = () => {
  if (event.value) openCancelEventDialog(event.value)
}

onBeforeUnmount(() => {
  useEventStore().$reset()
})

useMeta({
  title: event.value?.name,
  meta: {
    description: { content: event.value?.description },
    'og:image': { content: getImageSrc(event.value?.image) }
  }
})

const loaded = ref(false)

onMounted(async () => {
  const eventSlug = route.params.slug as string
  LoadingBar.start()
  console.log('EventPage mounted, loading data for:', eventSlug)

  // Initialize global tracker if needed
  if (!window.lastEventPageLoad) {
    window.lastEventPageLoad = {}
  }

  // First check auth status to ensure we have latest token
  const authSession = useAuthSession()
  await authSession.checkAuthStatus()

  // Check if we've recently loaded this event to avoid duplicate/competing loads
  const now = Date.now()
  const lastLoad = window.lastEventPageLoad[eventSlug] || 0
  const timeSinceLastLoad = now - lastLoad

  // Now load event data with latest auth state
  try {
    // Always track when we load this event
    window.lastEventPageLoad[eventSlug] = now

    // IMPORTANT: Set a globally accessible flag to indicate this event is being loaded
    // This allows child components to avoid making redundant API calls
    window.eventBeingLoaded = eventSlug

    // First, load the event data and wait for it to complete
    // This ensures child components have access to event and attendance data
    if (!useEventStore().event || useEventStore().event.slug !== eventSlug || timeSinceLastLoad > 2000) {
      await useEventStore().actionGetEventBySlug(eventSlug)
      console.log('Event data loaded, now child components can use this data')
    } else {
      console.log('Using existing event data from store, skipping reload')
    }

    // Then load non-critical data in parallel
    await Promise.all([
      // Load similar events
      loadSimilarEvents(eventSlug),

      // Load series data if applicable
      useEventStore().event?.seriesSlug ? loadUpcomingOccurrences() : Promise.resolve()
    ])

    // Log warning for navigation issues
    if (!useEventStore().event?.seriesSlug && useEventStore().event?.seriesId) {
      console.warn('Event has seriesId but no seriesSlug, this might cause navigation issues')
    }
  } catch (error) {
    console.error('Error loading event data:', error)
  } finally {
    // Clear the global loading flag when done
    window.eventBeingLoaded = null
    LoadingBar.stop()
  }
})

// Add this function to load similar events
const loadSimilarEvents = async (slug: string) => {
  similarEventsLoading.value = true
  try {
    const response = await eventsApi.similarEvents(slug)
    similarEvents.value = response.data
  } catch (error) {
    console.error('Failed to load similar events:', error)
  } finally {
    similarEventsLoading.value = false
  }
}

// Update your route watcher to include similar events
onBeforeRouteUpdate(async (to) => {
  loaded.value = false
  if (to.params.slug) {
    try {
      LoadingBar.start()
      await Promise.all([
        eventsApi.getBySlug(String(to.params.slug)).then((response) => {
          useEventStore().event = response.data
        }),
        loadSimilarEvents(String(to.params.slug))
      ])
    } catch (error) {
      console.error('Failed to load event:', error)
    } finally {
      loaded.value = true
      LoadingBar.stop()
    }
  }
})

const spotsLeft = computed(() =>
  event.value?.maxAttendees
    ? event.value.maxAttendees - (event.value.attendeesCount || 0)
    : 0
)

// Navigate to the event series page
const navigateToEventSeries = async () => {
  // Add more detailed logging
  console.log('-----SERIES NAVIGATION DEBUG-----')
  console.log('Event data:', event.value)
  console.log('Series info:', {
    seriesSlug: event.value?.seriesSlug,
    seriesId: event.value?.seriesId,
    isRecurring: event.value?.isRecurring
  })

  // Primary navigation approach - using seriesSlug
  if (event.value?.seriesSlug) {
    const url = `/event-series/${event.value.seriesSlug}`
    console.log('Navigating to:', url)
    router.push(url)
    return
  }

  // Fallback - if somehow we have seriesId but no seriesSlug, use the event name
  // This should rarely happen if the API is working correctly
  if (event.value?.seriesId && event.value?.name) {
    console.warn('No seriesSlug found but seriesId exists - using fallback navigation')

    // Create a simple slug from the event name
    const fallbackSlug = event.value.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    console.log('No seriesSlug found, trying fallback with event name:', fallbackSlug)

    const url = `/event-series/${fallbackSlug}`
    console.log('Navigating to fallback URL:', url)
    router.push(url)
    return
  }

  // As a last resort, go to the events list
  console.warn('Unable to navigate to series - missing seriesSlug')
  router.push('/events')
}

// Load upcoming occurrences only when we have a seriesSlug
const loadUpcomingOccurrences = async () => {
  if (event.value?.seriesSlug) {
    try {
      const seriesSlug = event.value.seriesSlug
      console.log('Loading upcoming occurrences for series:', seriesSlug)

      // Log recurrence rule info to debug monthly patterns
      if (event.value?.recurrenceRule) {
        console.log('Event has recurrence rule:', {
          frequency: event.value.recurrenceRule.frequency,
          interval: event.value.recurrenceRule.interval,
          byweekday: event.value.recurrenceRule.byweekday,
          bymonthday: event.value.recurrenceRule.bymonthday,
          bysetpos: event.value.recurrenceRule.bysetpos
        })

        // Check specifically for monthly patterns with bysetpos
        if (event.value.recurrenceRule.frequency === 'MONTHLY' &&
            event.value.recurrenceRule.byweekday &&
            event.value.recurrenceRule.bysetpos) {
          console.log('MONTHLY BYSETPOS PATTERN DETECTED in EventPage:', {
            byweekday: event.value.recurrenceRule.byweekday,
            bysetpos: event.value.recurrenceRule.bysetpos,
            description: `${event.value.recurrenceRule.bysetpos[0]}${event.value.recurrenceRule.byweekday[0]} of month`
          })
        }
      }

      // First, load all materialized events from the series directly
      // to ensure we don't miss any events with custom dates
      try {
        console.log('Loading all materialized events for series first')
        const allSeriesEvents = await EventSeriesService.getEventsBySeriesSlug(seriesSlug)
        console.log(`Found ${allSeriesEvents.length} materialized events for series`)

        // Create a map of already materialized events by date (roughly)
        const materializedEvents = new Map()

        // Only include future events
        const now = new Date()
        allSeriesEvents
          .filter(evt => new Date(evt.startDate) > now)
          .forEach(evt => {
            // Use date string without time for rough matching
            const dateKey = new Date(evt.startDate).toISOString().split('T')[0]
            materializedEvents.set(dateKey, evt)
          })

        console.log(`Found ${materializedEvents.size} future materialized events to include`)

        // Now load the series to get the recurrence rule for unmaterialized future occurrences
        console.log('Fetching complete series data for recurrence pattern')
        const series = await EventSeriesService.getBySlug(seriesSlug)

        // If we have a valid monthly pattern in the series, use client-side generation
        if (series.recurrenceRule?.frequency === 'MONTHLY' &&
            series.recurrenceRule?.byweekday &&
            series.recurrenceRule?.bysetpos) {
          console.log('USING CLIENT-SIDE GENERATION for accurate monthly pattern')

          // Create a mock event with the series recurrence rule for accurate generation
          const mockEvent: Partial<EventEntity> = {
            id: 0,
            ulid: 'mock',
            slug: 'mock',
            type: EventType.Online,
            name: series.name,
            startDate: event.value?.startDate || new Date().toISOString(),
            recurrenceRule: series.recurrenceRule,
            timeZone: series.timeZone
          }

          // Use the RecurrenceService to generate accurate occurrences
          const generatedOccurrences = RecurrenceService.getOccurrences(mockEvent as EventEntity, 15)
          console.log('Client-side generated occurrences:',
            generatedOccurrences.map(d => d.toISOString()))

          // Filter to future occurrences and limit to 10
          const futureOccurrences = generatedOccurrences
            .filter(date => date > now)
            .slice(0, 10)

          // For each occurrence date, check if we already have a materialized event
          const combinedOccurrences = futureOccurrences.map(date => {
            const dateKey = date.toISOString().split('T')[0]
            const existingEvent = materializedEvents.get(dateKey)

            return {
              date,
              eventSlug: existingEvent?.slug || null
            }
          })

          // Now add any materialized events that didn't match a pattern date
          // (these are custom scheduled dates that don't exactly match the pattern)
          materializedEvents.forEach((evt, dateKey) => {
            // Check if this materialized event is already included
            const alreadyIncluded = combinedOccurrences.some(
              occ => occ.eventSlug === evt.slug
            )

            if (!alreadyIncluded) {
              console.log(`Adding missing materialized event: ${evt.slug} (${dateKey})`)
              combinedOccurrences.push({
                date: new Date(evt.startDate),
                eventSlug: evt.slug
              })
            }
          })

          // Sort by date, limit to next 5 occurrences
          upcomingOccurrences.value = combinedOccurrences
            .sort((a, b) => a.date.getTime() - b.date.getTime())
            .slice(0, 5)

          console.log('Final combined occurrences:', upcomingOccurrences.value)
          return
        }

        // Fallback to API-based occurrences
        console.log('Using API-based occurrences combined with materialized events')
        const response = await EventSeriesService.getOccurrences(seriesSlug, 10, false)

        // Filter to future occurrences
        const apiOccurrences = response
          .filter(occurrence => new Date(occurrence.date) > now)
          .map(occurrence => ({
            date: new Date(occurrence.date),
            eventSlug: occurrence.event?.slug || null
          }))

        // Now, similar to above, add any materialized events not already included
        materializedEvents.forEach((evt, dateKey) => {
          // Check if this materialized event is already included
          const alreadyIncluded = apiOccurrences.some(
            occ => occ.eventSlug === evt.slug
          )

          if (!alreadyIncluded) {
            console.log(`Adding missing materialized event from API approach: ${evt.slug} (${dateKey})`)
            apiOccurrences.push({
              date: new Date(evt.startDate),
              eventSlug: evt.slug
            })
          }
        })

        // Sort by date, limit to next 5 occurrences
        upcomingOccurrences.value = apiOccurrences
          .sort((a, b) => a.date.getTime() - b.date.getTime())
          .slice(0, 5)

        console.log('Final API-based occurrences:', upcomingOccurrences.value)
      } catch (err) {
        console.error('Error in combined approach, falling back to API only:', err)

        // Fall back to API-only approach if the combined approach fails
        const response = await EventSeriesService.getOccurrences(seriesSlug, 10)

        // Filter out only future occurrences
        const now = new Date()
        upcomingOccurrences.value = response
          .filter(occurrence => new Date(occurrence.date) > now)
          .map(occurrence => ({
            date: new Date(occurrence.date),
            eventSlug: occurrence.event?.slug || null
          }))
          .slice(0, 5) // Limit to next 5 occurrences

        console.log('Fallback API occurrences:', upcomingOccurrences.value)
      }

      // Check if occurrences look weekly or monthly
      if (upcomingOccurrences.value.length >= 2) {
        const date1 = upcomingOccurrences.value[0].date
        const date2 = upcomingOccurrences.value[1].date
        const diffDays = (date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24)
        console.log(`Days between first two displayed occurrences: ${diffDays}`)
        console.log(`Pattern displayed appears to be: ${diffDays < 10 ? 'WEEKLY' : 'MONTHLY'}`)
      }
    } catch (error) {
      console.error('Failed to load upcoming occurrences:', error)
    }
  }
}

// Define the type for occurrence
interface SeriesOccurrence {
  date: Date;
  eventSlug: string | null;
}

const navigateToEvent = (eventSlug: string) => {
  router.push(`/events/${eventSlug}`)
}

// Handle click on unmaterialized event
const handleUnmaterializedEvent = (occurrence: SeriesOccurrence) => {
  // If the event is unmaterialized (no eventSlug), we'll show a temporary view
  // with option to materialize
  if (event.value) {
    // Use query parameter approach for template views
    router.push({
      name: 'EventPage',
      params: { slug: event.value.slug },
      query: {
        templateView: 'true',
        occurrenceDate: occurrence.date.toISOString()
      }
    })
  }
}

// Check if we're in template view mode (showing a future unmaterialized occurrence)
const isTemplateView = computed(() => {
  return route.query.templateView === 'true' && !!route.query.occurrenceDate
})

// Get the projected date for template view
const templateDate = computed(() => {
  if (isTemplateView.value && route.query.occurrenceDate) {
    return route.query.occurrenceDate as string
  }
  return null
})

const handleEditEvent = async () => {
  // If in template view, we need to materialize this event instance first
  if (isTemplateView.value && templateDate.value && event.value) {
    try {
      LoadingBar.start()

      // Use the centralized materialization function with false for auto-navigation
      const materializedEvent = await useEventStore().actionMaterializeOccurrence(
        event.value.seriesSlug as string,
        new Date(templateDate.value).toISOString(),
        false // Don't navigate automatically, we'll handle it here
      )

      // Navigate to the newly materialized event edit page
      if (materializedEvent && materializedEvent.slug) {
        // Use window.location for consistent navigation approach
        window.location.href = `/dashboard/events/${materializedEvent.slug}`
      } else {
        console.error('Failed to materialize event occurrence: No slug returned')
      }
    } catch (error) {
      console.error('Error materializing event occurrence:', error)
      // Show error notification
      $q.notify({
        type: 'negative',
        message: 'Failed to materialize event: ' + (error.message || 'Unknown error')
      })
    } finally {
      LoadingBar.stop()
    }
  } else {
    // Regular edit for already materialized events
    router.push({
      name: 'DashboardEventPage',
      params: { slug: event.value?.slug }
    })
  }
}

// Update the isOwnerOrAdmin computed property
const isOwnerOrAdmin = computed(() => {
  if (!event.value?.series?.user) return false

  const authStore = useAuthStore()

  // Check if user is owner
  const isOwner = event.value.series.user.id === authStore.getUserId

  // Check if user is admin (has manage events permission)
  const isAdmin = useEventStore().getterGroupMemberHasPermission(GroupPermission.ManageEvents)

  return isOwner || isAdmin
})

</script>

<style scoped lang="scss">
.bio-content {
  max-width: 100%;

  :deep(a) {
    color: var(--q-primary);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }

    &::after {
      display: none;
    }
  }

  :deep(img) {
    max-width: 100%;
    border-radius: 4px;
  }

  :deep(code) {
    background-color: rgba(0, 0, 0, 0.05);
    padding: 2px 4px;
    border-radius: 4px;
    font-family: monospace;
  }

  :deep(blockquote) {
    border-left: 4px solid var(--q-primary);
    margin-left: 0;
    padding-left: 16px;
    color: rgba(0, 0, 0, 0.7);
  }
}

.series-occurrences {
  .scheduled-event {
    background-color: rgba(33, 150, 83, 0.05);
    border-left: 3px solid var(--q-positive);

    &:hover {
      background-color: rgba(33, 150, 83, 0.1);
    }
  }

  .potential-event {
    border-left: 3px solid var(--q-grey-7);
    opacity: 0.85;

    &:hover {
      background-color: rgba(0, 0, 0, 0.03);
      opacity: 1;
    }
  }
}
</style>
