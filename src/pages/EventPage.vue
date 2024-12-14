<template>
  <q-page padding style="padding-bottom: 110px; max-width: 1201px;" class="q-mx-auto c-event-page">
    <SpinnerComponent v-if="useEventStore().isLoading" />
    <template v-else-if="event">

      <!-- Title -->
      <div data-cy="event-name" :class="[Dark.isActive ? 'bg-dark' : 'bg-white']"
        class="text-h4 text-bold bg-inherit q-py-sm">{{
          event.name
        }}
      </div>

      <!-- Lead block -->
      <EventLeadComponent />

      <div class="row q-col-gutter-md q-mt-lg">
        <div class="col-12 col-md-8">
          <q-card class="shadow-0">
            <q-img data-cy="event-image" :src="getImageSrc(event.image)" :ratio="16 / 9" />
          </q-card>

          <q-card class="shadow-0 q-mt-lg">
            <q-card-section>
              <div class="text-h5">Details</div>
              <div data-cy="event-description" class="text-body1 q-mt-md" v-html="event.description"></div>
            </q-card-section>
          </q-card>

          <EventAttendeesComponent />

          <EventTopicsComponent />
        </div>
        <div class="col-12 col-md-4">
          <div style="position: sticky; top: 70px">

            <!-- Organiser tools -->
            <q-card class="q-mb-md shadow-0"
              v-if="useEventStore().getterGroupMemberHasPermission(GroupPermission.ManageEvents) ||
              useEventStore().getterUserHasPermission(EventAttendeePermission.ManageEvent)"
              >
              <q-card-section>
                <q-btn-dropdown data-cy="organiser-tools" ripple flat align="center" no-caps label="Organiser tools">
                  <q-list>
                    <MenuItemComponent label="Edit event" icon="sym_r_edit_note"
                      v-if="useEventStore().getterUserHasPermission(EventAttendeePermission.ManageEvent)"
                      @click="router.push({ name: 'DashboardEventPage', params: { slug: event.slug } })" />
                    <MenuItemComponent label="Manage attendees" icon="sym_r_people"
                      v-if="useEventStore().getterUserHasPermission(EventAttendeePermission.ManageAttendees)"
                      @click="router.push({ name: 'EventAttendeesPage' })" />
                    <MenuItemComponent label="Cancel event"
                      v-if="useEventStore().getterUserHasPermission(EventAttendeePermission.CancelEvent)"
                      icon="sym_r_event_busy" @click="onCancelEvent" />
                    <q-separator />
                    <MenuItemComponent label="Delete event"
                      v-if="useEventStore().getterUserHasPermission(EventAttendeePermission.DeleteEvent)"
                      icon="sym_r_delete" @click="onDeleteEvent" />
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
                        <img v-if="event.group.image" :src="getImageSrc(event.group.image)" :alt="event.group.name">
                        <q-icon v-else name="sym_r_group" />
                      </q-avatar>
                    </q-item-section>
                    <q-item-section>
                      <q-item-label>{{ event.group.name }}</q-item-label>
                      <q-item-label caption>{{ event.group.visibility }} group</q-item-label>
                    </q-item-section>
                  </q-item>
                </div>
              </q-card-section>
            </q-card>

            <!-- Details section -->
            <q-card flat bordered class="q-mb-lg">
              <q-card-section>
                <q-item>
                  <q-item-section side>
                    <q-icon name="sym_r_schedule" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ formatDate(event.startDate) }}</q-item-label>
                    <q-item-label v-if="event.endDate">{{ formatDate(event.endDate) }}</q-item-label>
                  </q-item-section>
                </q-item>
                <q-item>
                  <q-item-section side>
                    <q-icon label="In person" v-if="event.type === 'in-person'" icon="sym_r_person_pin_circle"
                      name="sym_r_person_pin_circle" />
                    <q-icon label="Online" v-if="event.type === 'online'" name="sym_r_videocam" />
                    <q-icon label="Hybrid" v-if="event.type === 'hybrid'" name="sym_r_diversity_2" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ event.type }} event</q-item-label>
                    <q-btn no-caps size="md" align="left" flat padding="none" target="_blank"
                      :href="event.locationOnline">Online link
                    </q-btn>
                    <q-item-label class="cursor-pointer">
                      {{ event.location }}
                      <q-popup-proxy>
                        <q-card class="q-pa-md" style="height: 500px; width: 500px">
                          <LeafletMapComponent disabled style="height: 300px; width: 300px" :lat="event.lat"
                            :lon="event.lon" />
                        </q-card>
                      </q-popup-proxy>
                    </q-item-label>
                  </q-item-section>
                </q-item>
              </q-card-section>
              <!--              <LeafletMapComponent v-if="event" disabled style="height: 300px; width: 300px" :lat="event.lat" :lon="event.lon"/>-->
            </q-card>
          </div>
        </div>
      </div>

    </template>

    <EventStickyComponent v-if="event" :event="event" style="z-index: 1000" />
    <NoContentComponent data-cy="event-not-found" v-if="errorMessage" label="Event not found" icon="sym_r_error"
      @click="router.push({ name: 'EventsPage' })" button-label="Go to events" />

    <EventSimilarEventsComponent v-if="showSimilarEvents && event && !errorMessage" :event="event" />
  </q-page>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Dark, LoadingBar, useMeta } from 'quasar'
import { getImageSrc } from 'src/utils/imageUtils.ts'
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
import EventSimilarEventsComponent from 'src/components/event/EventSimilarEventsComponent.vue'
import { GroupPermission } from 'src/types/group.ts'
import { EventAttendeePermission } from 'src/types/event.ts'
import EventAttendeesComponent from 'src/components/event/EventAttendeesComponent.vue'
import EventTopicsComponent from 'src/components/event/EventTopicsComponent.vue'

const route = useRoute()
const router = useRouter()
const showSimilarEvents = ref<boolean>(false)
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

onMounted(() => {
  LoadingBar.start()
  useEventStore().actionGetEventBySlug(route.params.slug as string).finally(() => {
    showSimilarEvents.value = true
    LoadingBar.stop()
  })
})
</script>
