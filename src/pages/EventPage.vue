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
                  class="text-body1 q-mt-md"
                  v-html="event.description"
                ></div>
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
                </q-item-section>
              </q-item>
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
                  <q-item-label>{{ event.type }} event</q-item-label>
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
            label="Similar Events"
            :events="similarEvents"
            :loading="similarEventsLoading"
            :hide-link="true"
            layout="list"
          />
        </div>
      </div>
    </template>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter, onBeforeRouteUpdate } from 'vue-router'
import { Dark, LoadingBar, useMeta } from 'quasar'
import { getImageSrc } from 'src/utils/imageUtils.ts'
import { eventsApi } from 'src/api/events'
import { formatDate } from '../utils/dateUtils.ts'
import LeafletMapComponent from 'components/common/LeafletMapComponent.vue'
import MenuItemComponent from 'components/common/MenuItemComponent.vue'
import { useEventDialog } from 'src/composables/useEventDialog.ts'
import EventLeadComponent from 'components/event/EventLeadComponent.vue'
import { useEventStore } from 'stores/event-store.ts'
import SpinnerComponent from 'components/common/SpinnerComponent.vue'
import NoContentComponent from 'components/global/NoContentComponent.vue'
import { useNavigation } from 'src/composables/useNavigation.ts'
import EventsListComponent from 'src/components/event/EventsListComponent.vue'
import { GroupPermission } from 'src/types/group.ts'
import { EventAttendeePermission, EventStatus } from 'src/types/event.ts'
import EventAttendeesComponent from 'src/components/event/EventAttendeesComponent.vue'
import EventTopicsComponent from 'src/components/event/EventTopicsComponent.vue'
import {
  EventEntity,
  EventAttendeeStatus
} from 'src/types'
import { pluralize } from 'src/utils/stringUtils.ts'
import ShareComponent from 'components/common/ShareComponent.vue'
import QRCodeComponent from 'components/common/QRCodeComponent.vue'
import EventAttendanceButton from 'components/event/EventAttendanceButton.vue'

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

onMounted(() => {
  LoadingBar.start()
  Promise.all([
    useEventStore().actionGetEventBySlug(route.params.slug as string),
    loadSimilarEvents(route.params.slug as string)
  ]).finally(() => {
    LoadingBar.stop()
  })
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

</script>
