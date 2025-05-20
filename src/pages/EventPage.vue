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
                    {{ RecurrenceService.formatWithTimezone(
                      templateDate,
                      { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' },
                      RecurrenceService.getUserTimezone() || event.timeZone
                    ) }}
                  </template>
                  <template v-else>
                    {{ RecurrenceService.formatWithTimezone(
                      event.startDate,
                      { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' },
                      RecurrenceService.getUserTimezone() || event.timeZone
                    ) }}
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
          <!-- Organizer tools -->
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
                data-cy="Organizer-tools"
                ripple
                flat
                align="center"
                no-caps
                label="Organizer tools"
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

          <!-- Organizer section -->
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
                  <q-item-label>
                    {{ RecurrenceService.formatWithTimezone(
                      event.startDate,
                      { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' },
                      RecurrenceService.getUserTimezone() || event.timeZone
                    ) }}
                  </q-item-label>
                  <q-item-label v-if="event.endDate">
                    {{ RecurrenceService.formatWithTimezone(
                      event.endDate,
                      { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' },
                      RecurrenceService.getUserTimezone() || event.timeZone
                    ) }}
                  </q-item-label>
                  <q-item-label caption v-if="event.timeZone && RecurrenceService.getUserTimezone() && event.timeZone !== RecurrenceService.getUserTimezone()">
                    <div class="row items-center q-gutter-sm q-mt-sm">
                      <span class="text-italic">
                        Event time in original timezone ({{ event.timeZone }}):
                        {{ RecurrenceService.formatWithTimezone(event.startDate, { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }, event.timeZone) }}
                      </span>
                    </div>
                  </q-item-label>
                  <q-item-label caption>
                    <div class="row items-center q-gutter-sm q-mt-sm">
                      <span class="text-italic">
                        Dates shown in your local time{{ RecurrenceService.getUserTimezone() ? ` (${RecurrenceService.getUserTimezone()})` : '' }}
                      </span>
                    </div>
                  </q-item-label>
                </q-item-section>
              </q-item>

              <!-- Recurrence information -->
              <RecurrenceDisplayComponent v-if="event.isRecurring" :event="event" />

              <!-- Enhanced Recurrence Display - Not hidden in expansion panel -->
              <q-item v-if="event.seriesSlug" class="q-mt-md series-occurrences">
                <q-item-section>
                  <q-item-label class="text-weight-medium q-mb-sm">Upcoming Occurrences</q-item-label>

                  <!-- Debug information for recurrence rule - only shown in development mode when showDebugRecurrenceInfo is true -->
                  <div v-if="showDebugRecurrenceInfo" class="text-caption q-mb-sm" style="border: 1px solid #ddd; padding: 8px; background-color: #f9f9f9;">
                    <div class="row justify-between items-center">
                      <div class="text-weight-bold">Recurrence Rule Debug Info:</div>
                      <q-btn flat dense size="sm" color="grey" label="Hide Debug Info" @click="toggleDebugInfo(false)" />
                    </div>
                    <div v-if="event.series?.templateEvent">
                      <div><b>Series Template Event Slug:</b> {{ event.series.templateEvent?.slug }}</div>
                      <div><b>Series Template Event Name:</b> {{ event.series.templateEvent?.name }}</div>
                      <div><b>Series Timezone:</b> {{ event.series?.timeZone || 'Not set' }}</div>
                    </div>
                    <div v-else-if="event.recurrenceRule">
                      <div><b>Event Start Date:</b> {{ event.startDate ? new Date(event.startDate).toISOString() : 'Not set' }}</div>
                      <div><b>Event Start (Local):</b> {{ event.startDate ? RecurrenceService.formatWithTimezone(event.startDate, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }, event.timeZone) : 'Not set' }}</div>
                      <div><b>Event Frequency:</b> {{ event.recurrenceRule.frequency }}</div>
                      <div><b>Event Interval:</b> {{ event.recurrenceRule.interval || 1 }}</div>
                      <div><b>Event Weekdays:</b> {{ Array.isArray(event.recurrenceRule.byweekday) ? event.recurrenceRule.byweekday.join(', ') : 'None' }}</div>
                      <div><b>Event Month:</b> {{ Array.isArray(event.recurrenceRule.bymonth) ? event.recurrenceRule.bymonth.join(', ') : 'None' }}</div>
                      <div><b>Event Day of Month:</b> {{ Array.isArray(event.recurrenceRule.bymonthday) ? event.recurrenceRule.bymonthday.join(', ') : 'None' }}</div>
                      <div><b>Event Position:</b> {{ Array.isArray(event.recurrenceRule.bysetpos) ? event.recurrenceRule.bysetpos.join(', ') : 'None' }}</div>
                      <div><b>Event Timezone:</b> {{ event.timeZone || 'Not set' }}</div>
                      <div><b>User Explicit Selection:</b> {{ event.recurrenceRule._userExplicitSelection ? 'Yes' : 'No' }}</div>
                    </div>
                    <div v-else>No recurrence rule found in event or series</div>

                    <div class="text-weight-bold q-mt-sm">API Request Info:</div>
                    <div>Series Slug: {{ event.seriesSlug }}</div>
                    <div>Series ID: {{ event.seriesId }}</div>
                  </div>

                  <!-- Button to show debug info when hidden - only in development mode -->
                  <div v-if="!showDebugRecurrenceInfo && isDevelopmentMode" class="q-mb-sm">
                    <q-btn flat dense size="sm" color="grey-7" icon="sym_r_bug_report" label="Show Debug Info" @click="toggleDebugInfo(true)" />
                  </div>

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
                        <q-item-label>{{ RecurrenceService.formatWithTimezone(occurrence.date, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }, undefined) }}</q-item-label>
                        <q-item-label caption v-if="occurrence.eventSlug" class="text-positive">
                          <q-icon name="sym_r_check_circle" size="xs" class="q-mr-xs" />Scheduled event
                        </q-item-label>
                        <q-item-label caption v-else class="text-grey-7">
                          <q-icon name="sym_r_today" size="xs" class="q-mr-xs" />Potential event
                        </q-item-label>
                        <!-- Detailed date info only shown when debug mode is enabled -->
                        <q-item-label v-if="showDebugRecurrenceInfo" caption class="text-grey-8">
                          <b>DOW:</b> {{ new Date(occurrence.date).toLocaleDateString('en-US', { weekday: 'long' }) }},
                          <b>UTC:</b> {{ occurrence.date.toISOString() }},
                          <b>Local day:</b> {{ formatInTimezone(occurrence.date, { weekday: 'long' }, event.timeZone) }}
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

                  <div class="row justify-between q-mt-sm">
                    <q-btn
                      flat
                      color="grey"
                      label="Refresh Occurrences"
                      @click="loadUpcomingOccurrences"
                      class="text-weight-medium text-caption"
                    />
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
import { chatApi } from '../api/chat'
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
import { EventAttendeePermission, EventStatus } from '../types/event'
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
import { useAuthStore } from '../stores/auth-store'
import { EventSeriesService } from '../services/eventSeriesService'
import { RecurrenceService } from '../services/recurrenceService'

// Define the type for occurrence
interface SeriesOccurrence {
  date: Date;
  eventSlug: string | null;
}

// Define interface for the attendee status change event
interface AttendeeStatusChangeDetail {
  eventSlug: string;
  status: string;
  timestamp: number;
}

interface AttendeeStatusChangeEvent extends Event {
  detail: AttendeeStatusChangeDetail;
}

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
const usingClientSideGeneration = ref(false)
const showDebugRecurrenceInfo = ref(false) // Debug flag for recurrence information

// Helper function to format dates with timezone
const formatInTimezone = (date: Date, options: Intl.DateTimeFormatOptions, tz?: string): string => {
  try {
    const timezone = tz || RecurrenceService.getUserTimezone()
    return new Intl.DateTimeFormat('en-US', { ...options, timeZone: timezone }).format(date)
  } catch (error) {
    console.error('Error formatting date with timezone:', error)
    return String(date)
  }
}

// Function to toggle debug info and save preference to localStorage
const toggleDebugInfo = (show: boolean) => {
  showDebugRecurrenceInfo.value = show
  // Only save the preference in development mode
  if (isDevelopmentMode.value) {
    localStorage.setItem('openmeet_show_recurrence_debug', show ? 'true' : 'false')
  }
}

const onDeleteEvent = () => {
  if (event.value) openDeleteEventDialog(event.value)
}

const onCancelEvent = () => {
  if (event.value) openCancelEventDialog(event.value)
}

// Handle attendee status changes to automatically join chat room when a user becomes confirmed
const handleAttendeeStatusChanged = async (e: Event) => {
  // Custom events have a detail property
  if (!e || !('detail' in e)) return

  // Use the properly typed event
  const customEvent = e as AttendeeStatusChangeEvent
  const { eventSlug, status, timestamp } = customEvent.detail
  console.log(`EventPage received attendance status change: ${eventSlug}, status=${status} at ${new Date(timestamp).toISOString()}`)

  // Only handle changes for the current event
  if (eventSlug === route.params.slug) {
    // If the user just became a confirmed attendee, join the chat room
    if (status === 'confirmed') {
      console.log('User attendance status changed to confirmed, joining chat room')

      // Add a small delay to ensure backend state is updated
      await new Promise(resolve => setTimeout(resolve, 500))

      try {
        const userSlug = useAuthStore().user?.slug
        if (userSlug) {
          console.log(`Joining chat room for event ${eventSlug} after status change to confirmed`)
          const joinResult = await chatApi.addMemberToEventDiscussion(eventSlug, userSlug)
          console.log('Chat room join result after status change:', joinResult.data)

          if (joinResult.data?.roomId) {
            console.log(`Successfully joined Matrix room after status change: ${joinResult.data.roomId}`)
          }
        }
      } catch (err) {
        console.error('Failed to join chat room after attendance status change:', err)
      }
    }
  }
}

onMounted(() => {
  // Listen for attendance status changes (sent from EventAttendanceButton.vue)
  window.addEventListener('attendee-status-changed', handleAttendeeStatusChanged)
})

onBeforeUnmount(() => {
  // Clean up event listener
  window.removeEventListener('attendee-status-changed', handleAttendeeStatusChanged)
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

// Check if we're running in development mode
const isDevelopmentMode = computed(() => {
  return import.meta.env.MODE === 'development' ||
         window.location.hostname === 'localhost' ||
         window.location.hostname === '127.0.0.1'
})

onMounted(async () => {
  const eventSlug = route.params.slug as string
  LoadingBar.start()
  console.log('EventPage mounted, loading data for:', eventSlug)

  // Initialize global tracker if needed
  if (!window.lastEventPageLoad) {
    window.lastEventPageLoad = {}
  }

  // Only show debug button in development mode by default
  showDebugRecurrenceInfo.value = isDevelopmentMode.value &&
    (localStorage.getItem('openmeet_show_recurrence_debug') === 'true')

  // Check if we've recently loaded this event to avoid duplicate/competing loads
  const now = Date.now()
  const lastLoad = window.lastEventPageLoad[eventSlug] || 0
  const timeSinceLastLoad = now - lastLoad

  // Load event data
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
      // DEBUG: Log timezone information (only in development mode)
      if (isDevelopmentMode.value) {
        console.log('DEBUG - Event timezone info:', {
          eventTimeZone: useEventStore().event?.timeZone,
          seriesTimeZone: useEventStore().event?.series?.timeZone,
          hasEventTimeZone: !!useEventStore().event?.timeZone,
          hasSeriesTimeZone: !!useEventStore().event?.series?.timeZone,
          eventObject: useEventStore().event,
          seriesObject: useEventStore().event?.series,
          recurrenceRule: useEventStore().event?.recurrenceRule,
          seriesRecurrenceRule: useEventStore().event?.series?.recurrenceRule
        })
      }
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

    // Automatically join chat room if user is a confirmed attendee
    // This ensures the user is added to the Matrix room for this event
    if (useEventStore().event?.attendee?.status === 'confirmed') {
      try {
        console.log('User is a confirmed attendee, ensuring chat room membership')
        const userSlug = useAuthStore().user?.slug

        if (userSlug) {
          console.log(`Joining chat room for event ${eventSlug} with user ${userSlug}`)
          const joinResult = await chatApi.addMemberToEventDiscussion(eventSlug, userSlug)
          console.log('Chat room join result:', joinResult.data)

          if (joinResult.data?.roomId) {
            console.log(`Successfully joined Matrix room: ${joinResult.data.roomId}`)
          }
        }
      } catch (err) {
        // Non-critical error, just log it but don't interrupt page load
        console.error('Failed to auto-join event chat room:', err)
      }
    } else {
      console.log('User is not a confirmed attendee, skipping chat room join')
    }
  } catch (error) {
    console.error('Error loading event data:', error)
  } finally {
    // Clear the global loading flag when done
    window.eventBeingLoaded = null
    LoadingBar.stop()
  }
})

// Update the loadSimilarEvents function back to original
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

// Enhanced onBeforeRouteUpdate to join chat room when navigating between events
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

      // After loading the event, check if user is a confirmed attendee and join chat room
      const eventSlug = String(to.params.slug)
      if (useEventStore().event?.attendee?.status === 'confirmed') {
        try {
          console.log('User is a confirmed attendee after route update, ensuring chat room membership')
          const userSlug = useAuthStore().user?.slug

          if (userSlug) {
            console.log(`Joining chat room for event ${eventSlug} with user ${userSlug}`)
            const joinResult = await chatApi.addMemberToEventDiscussion(eventSlug, userSlug)
            console.log('Chat room join result after route update:', joinResult.data)

            if (joinResult.data?.roomId) {
              console.log(`Successfully joined Matrix room after route update: ${joinResult.data.roomId}`)
            }
          }
        } catch (err) {
          // Non-critical error, just log it but don't interrupt page load
          console.error('Failed to auto-join event chat room after route update:', err)
        }
      }
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

// Revert navigateToEventSeries to original
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

// Revert handleUnmaterializedEvent to original
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

// Revert loadUpcomingOccurrences to original
const loadUpcomingOccurrences = async () => {
  if (event.value?.seriesSlug) {
    try {
      const seriesSlug = event.value.seriesSlug
      console.log('Loading upcoming occurrences for series:', seriesSlug)

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

        // Log the recurrence rule for debugging (only in development mode)
        if (isDevelopmentMode.value) {
          console.log('Series recurrence rule:', series.recurrenceRule)
          console.log('Series timezone:', series.timeZone)
          console.log('USING API-BASED OCCURRENCE GENERATION for all patterns')
        }
        usingClientSideGeneration.value = false

        // Get occurrences from the API
        const response = await EventSeriesService.getOccurrences(seriesSlug, 10, false)

        // Log detailed information about API response for debugging (only in development mode)
        if (isDevelopmentMode.value && response.length > 0) {
          console.log('API returned occurrences:', response.length)

          // Log each occurrence with detailed information
          response.slice(0, 5).forEach((occ, i) => {
            const occDate = new Date(occ.date)
            console.log(`Occurrence ${i + 1}:`, {
              dateString: occ.date,
              dateObject: occDate,
              jsDay: occDate.getDay(), // 0=Sunday, 1=Monday, etc.
              jsDate: occDate.getDate(), // day of month
              localeDay: occDate.toLocaleDateString('en-US', { weekday: 'long' }),
              utcString: occDate.toUTCString(),
              isoString: occDate.toISOString(),
              isoDayOfWeek: occDate.getUTCDay() + 1, // 1=Monday, 7=Sunday in ISO
              eventSlug: occ.event?.slug || 'unmaterialized',
              eventStartDate: occ.event?.startDate || null
            })
          })
        }

        // Filter to future occurrences
        const apiOccurrences = response
          .filter(occurrence => new Date(occurrence.date) > now)
          .map(occurrence => ({
            date: new Date(occurrence.date),
            eventSlug: occurrence.event?.slug || null
          }))

        // Add any materialized events that are not in the API response
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

        if (isDevelopmentMode.value) {
          console.log('Final API-based occurrences:', upcomingOccurrences.value)
        }
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

        if (isDevelopmentMode.value) {
          console.log('Fallback API occurrences:', upcomingOccurrences.value)
        }
      }

      // Check if occurrences look weekly or monthly (only in development mode)
      if (isDevelopmentMode.value && upcomingOccurrences.value.length >= 2) {
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

const navigateToEvent = (eventSlug: string) => {
  router.push(`/events/${eventSlug}`)
}

// No longer needed - we always use API generation

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

// Update the handleEditEvent function back to original
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
