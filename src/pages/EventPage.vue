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
                  {{ formatDate(event.startDate) }}
                </div>
                <span v-if="event.maxAttendees">
                  <span class="text-red">{{
                    spotsLeft > 0
                      ? `${spotsLeft} ${pluralize(spotsLeft, "spot")} left`
                      : "No spots left"
                  }}</span>
                </span>
                <div class="text-h6 text-bold">{{ event.name }}</div>
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
                  <EventAttendanceButton :event="event" :attendee="event.attendee" />

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
              )
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
                      )
                    "
                    @click="
                      router.push({
                        name: 'DashboardEventPage',
                        params: { slug: event.slug },
                      })
                    "
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

                  <!-- Promote event to series -->
                  <MenuItemComponent
                    v-if="
                      (!event.isRecurring || !event.seriesId) &&
                      useEventStore().getterUserHasPermission(
                        EventAttendeePermission.ManageEvent
                      )
                    "
                    label="Make recurring series"
                    icon="sym_r_event_repeat"
                    @click="openPromoteDialog"
                  />

                  <!-- Split recurring event series option - temporarily disabled -->
                  <!--
                  <MenuItemComponent
                    v-if="
                      event.isRecurring &&
                      useEventStore().getterUserHasPermission(
                        EventAttendeePermission.ManageEvent
                      )
                    "
                    label="Split recurring series"
                    icon="sym_r_event_repeat"
                    @click="splitDialogVisible = true"
                  />
                  -->
                  <q-separator />
                  <MenuItemComponent
                    label="Delete event"
                    v-if="
                      useEventStore().getterUserHasPermission(
                        EventAttendeePermission.DeleteEvent
                      )
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

              <!-- Recurrence Management (for event organizers only) -->
              <RecurrenceManagementComponent
                v-if="event.isRecurring && useEventStore().getterUserHasPermission(EventAttendeePermission.ManageEvent)"
                :event="event"
                @update:event="updateEventData" />
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
                          style="height: 300px; width: 300px"
                          :lat="event.lat"
                          :lon="event.lon"
                        />
                      </q-card>
                    </q-popup-proxy>
                  </q-item-label>
                </q-item-section>
              </q-item>
            </q-card-section>
            <LeafletMapComponent
              v-if="event"
              disabled
              style="height: 300px; width: 300px"
              :lat="event.lat"
              :lon="event.lon"
            />
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

    <!-- Promote to Series Dialog -->
    <PromoteToSeriesComponent
      v-if="event && (!event.isRecurring || !event.seriesId)"
      :is-open="promoteToSeriesDialogVisible"
      :event="event"
      @update:is-open="promoteToSeriesDialogVisible = $event"
      @series-created="onSeriesCreated"
    />

    <!-- Recurring Event Split Dialog -->
    <RecurrenceSplitDialogComponent
      v-if="event?.isRecurring"
      :is-open="splitDialogVisible"
      :event="event"
      @update:is-open="splitDialogVisible = $event"
      @series-split="onSeriesSplit"
    />
  </q-page>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter, onBeforeRouteUpdate } from 'vue-router'
import { Dark, LoadingBar, useMeta } from 'quasar'
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
import RecurrenceManagementComponent from '../components/event/RecurrenceManagementComponent.vue'
import RecurrenceSplitDialogComponent from '../components/event/RecurrenceSplitDialogComponent.vue'
import PromoteToSeriesComponent from '../components/event/PromoteToSeriesComponent.vue'
import { useAuthSession } from '../boot/auth-session'
const route = useRoute()
const router = useRouter()
const { navigateToGroup } = useNavigation()
const { openDeleteEventDialog, openCancelEventDialog } = useEventDialog()
const event = computed(() => useEventStore().event)
const errorMessage = computed(() => useEventStore().errorMessage)
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

// Add these for similar events
const similarEvents = ref<EventEntity[]>([])
const similarEventsLoading = ref(false)

// Recurring event split dialog
const splitDialogVisible = ref(false)

// Promote to series dialog
const promoteToSeriesDialogVisible = ref(false)

// Add type declaration for global window property
declare global {
  interface Window {
    lastEventPageLoad?: Record<string, number>;
  }
}

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

    await Promise.all([
      // Only reload event data if it's been more than 2 seconds since the last load
      // or if the event store doesn't have this event yet
      (!useEventStore().event || useEventStore().event.slug !== eventSlug || timeSinceLastLoad > 2000)
        ? useEventStore().actionGetEventBySlug(eventSlug)
        : Promise.resolve(console.log('Using existing event data from store, skipping reload')),

      // Always load similar events
      loadSimilarEvents(eventSlug)
    ])
  } catch (error) {
    console.error('Error loading event data:', error)
  } finally {
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

// Update event data in the store when child components update it
const updateEventData = (updatedEvent: EventEntity) => {
  useEventStore().event = updatedEvent
}

// Handle after series split
const onSeriesSplit = (newSeries: EventEntity) => {
  // Nothing to do here - navigation already happens in the component
  console.log('Series split successfully, new series:', newSeries.slug)
}

// Opens the promote to series dialog with debug logging
const openPromoteDialog = () => {
  console.log('Opening promote dialog, isRecurring =', event.value?.isRecurring, 'seriesId =', event.value?.seriesId)
  promoteToSeriesDialogVisible.value = true
}

// Handle after promoting to series
const onSeriesCreated = (seriesSlug: string) => {
  // Nothing to do here - navigation already happens in the component
  console.log('Event promoted to series successfully, new series:', seriesSlug)
}

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
</style>
