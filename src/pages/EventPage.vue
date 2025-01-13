<template>
  <q-page
    padding
    style="padding-bottom: 110px; max-width: 1201px"
    class="q-mx-auto c-event-page"
  >
    <SpinnerComponent v-if="useEventStore().isLoading" />
    <template v-else-if="event">
      <div class="row q-col-gutter-md q-mt-lg">
        <div class="col-12 col-md-8">
          <q-card class="shadow-0">
            <q-img
              data-cy="event-image"
              :src="getImageSrc(event.image)"
              :ratio="16 / 9"
            />
          </q-card>
          <EventAttendeesComponent />

          <!-- Discussions component -->
          <EventTopicsComponent />
        </div>
        <div class="col-12 col-md-4">
          <div style="position: sticky; top: 70px">
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
            <q-card flat bordered class="q-mb-md" v-if="event?.group">
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
            <q-card flat bordered class="q-mb-lg">
              <q-card-section>
                <div class="text-h6">Details</div>
                <!-- Title -->
                <div
                  data-cy="event-name"
                  :class="[Dark.isActive ? 'bg-dark' : 'bg-white']"
                  class="text-h4 text-bold bg-inherit q-py-sm"
                >
                  {{ event.name }}
                </div>
                <q-card-section>
                  float?
                  <!-- Lead block -->
                  <EventLeadComponent />
                </q-card-section>
                <q-card-section>
                  <div class="text-h5">Details</div>
                  <div
                    data-cy="event-description"
                    class="text-body1 q-mt-md"
                    v-html="event.description"
                  ></div>
                </q-card-section>
              </q-card-section>
              <q-card-section>
                <q-item>
                  <q-item-section side>
                    <q-icon name="sym_r_schedule" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{
                      formatDate(event.startDate)
                    }}</q-item-label>
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
                    <q-item-label
                      class="cursor-pointer text-underline text-blue"
                    >
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

            <!-- Action Button -->
            <q-btn
              v-if="hasPermissions"
              :color="isAttending ? 'grey' : 'primary'"
              class="full-width q-mb-md"
              :label="isAttending ? 'Leave' : 'Interested'"
              @click="onAttendClick"
              :loading="isLoading"
            />
            <q-btn
              v-else-if="
                useEventStore().getterIsAuthenticatedEvent &&
                !useAuthStore().isAuthenticated
              "
              color="primary"
              class="full-width q-mb-md"
              label="Login to join"
              @click="openLoginDialog"
            />
            <q-btn
              v-else-if="
                useEventStore().getterIsPrivateEvent &&
                !useEventStore().getterUserHasPermission(
                  EventAttendeePermission.ViewEvent
                )
              "
              color="grey"
              class="full-width q-mb-md"
              label="Private Event"
              @click="openNoAttendeesRightsDialog"
            />
          </div>
        </div>
      </div>
    </template>

    <EventStickyComponent v-if="event" :event="event" style="z-index: 1000" />
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
      <EventsListComponent
        label="Similar Events"
        :events="similarEvents"
        :loading="similarEventsLoading"
        :hide-link="true"
        layout="grid"
      />
    </template>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter, onBeforeRouteUpdate } from 'vue-router'
import { Dark, LoadingBar, useMeta, useQuasar } from 'quasar'
import { getImageSrc } from 'src/utils/imageUtils.ts'
import { eventsApi } from 'src/api/events'
import EventStickyComponent from 'components/event/EventStickyComponent.vue'
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
import { useAuthDialog } from 'src/composables/useAuthDialog'
import { useAuthStore } from 'src/stores/auth-store'
import { EventAttendeeEntity, EventEntity } from 'src/types'

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

const $q = useQuasar()
const { openLoginDialog } = useAuthDialog()
const { openNoAttendeesRightsDialog } = useEventDialog()
const isLoading = ref(false)

const isAttending = computed(() => {
  const attendee = useEventStore().getterUserIsAttendee()
  // Only consider as attending if there's an attendee and their status is not cancelled
  return !!attendee && attendee.status !== 'cancelled'
})

const hasPermissions = computed(() => {
  return (
    useEventStore().getterIsPublicEvent ||
    (useEventStore().getterIsAuthenticatedEvent &&
      useAuthStore().isAuthenticated) ||
    (useEventStore().getterUserIsAttendee() &&
      useEventStore().getterUserHasPermission(
        EventAttendeePermission.ViewEvent
      ))
  )
})

const onAttendClick = async () => {
  if (!event.value) return

  if (!useAuthStore().isAuthenticated) {
    openLoginDialog()
    return
  }

  try {
    isLoading.value = true
    if (isAttending.value) {
      await useEventStore().actionCancelAttending(event.value)
      await useEventStore().actionGetEventBySlug(event.value.slug)
      $q.notify({
        message: 'You have left the event',
        color: 'info'
      })
    } else {
      const attendeeData: Partial<EventAttendeeEntity> = {}
      await useEventStore().actionAttendEvent(event.value.slug, attendeeData)
      await useEventStore().actionGetEventBySlug(event.value.slug)
      $q.notify({
        message: 'You have joined the event',
        color: 'positive'
      })
    }
  } catch (error) {
    console.error('Attendance error:', error)
    $q.notify({
      message: 'Failed to update event attendance',
      color: 'negative'
    })
  } finally {
    isLoading.value = false
  }
}
</script>
