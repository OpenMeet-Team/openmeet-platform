<template>
  <q-page class="q-pa-md q-pb-xl" style="padding-bottom: 110px">
    <SpinnerComponent v-if="!loaded"/>
    <div v-else-if="event">
      <!-- Title -->
      <div :class="[Dark.isActive ? 'bg-dark' : 'bg-white']" class="text-h4 bg-inherit q-py-sm"
           style="position: sticky; top: 50px; z-index: 1001">{{ event.name }}
      </div>

      <EventLeadComponent/>

      <div class="row q-col-gutter-md q-mt-lg">
        <div class="col-12 col-md-8">
          <q-card class="shadow-0">
            <q-img :src="getImageSrc(event.image)" :ratio="16/9"/>
          </q-card>

          <q-card class="shadow-0 q-mt-lg">
              <div class="text-h5">Details</div>
              <div class="text-body1">{{ event.description }}</div>
          </q-card>

          <q-card class="q-mt-lg">
            <q-card-section>
              <div class="text-h5 q-mb-md">Attendees <span v-if="event.attendees?.length">{{ event.attendees.length }}</span></div>

              <q-linear-progress v-if="event.attendeesCount && event.maxAttendees"
                                 :value="event.attendeesCount / event.maxAttendees"
                                 color="secondary"
                                 class="q-mt-sm"
              />
              <div class="text-caption q-mt-sm">
                {{ event.attendeesCount }} <span v-if="event.maxAttendees">/ {{ event.maxAttendees }}</span> spots
                filled
              </div>
            </q-card-section>

            <q-card-actions align="right">
              <q-btn
                color="primary"
                label="RSVP"
                @click="rsvpToEvent"
                :disable="event.maxAttendees ? event.maxAttendees >= event.maxAttendees : false"
              />
            </q-card-actions>
          </q-card>
        </div>
        <div class="col-12 col-md-4">
          <div style="position: sticky; top: 100px">
            <q-card class="q-mb-md shadow-0">
              <q-card-section>
                <q-btn-dropdown align="center" no-caps label="Organiser tools">
                  <q-list>
                    <MenuItemComponent label="Edit event" icon="sym_r_edit_note"
                                       @click="router.push({ name: 'DashboardEventGeneralPage', params: { id: route.params.id }})"/>
                    <MenuItemComponent label="Manage attendees" icon="sym_r_people"
                                       @click="router.push({ name: 'DashboardEventAttendeesPage', params: { id: route.params.id }})"/>
                    <MenuItemComponent label="Cancel event" icon="sym_r_event_busy" @click="onCancelEvent"/>
                    <q-separator/>
                    <MenuItemComponent label="Delete event" icon="sym_r_delete" @click="onDeleteEvent"/>
                  </q-list>
                </q-btn-dropdown>
              </q-card-section>
            </q-card>
            <!-- Organiser section -->
            <q-card v-if="event?.group">
              <q-card-section>
                <div class="text-h6">Organizer</div>
                <div class="q-mt-md">
                  <q-item clickable
                          @click="router.push({ name: 'GroupPage', params: {slug: event.group.slug, id: encodeNumberToLowercaseString(event.group.id) } })">
                    <q-item-section avatar>
                      <q-avatar>
                        <img :src="getImageSrc(event.group.image)">
                      </q-avatar>
                    </q-item-section>
                    <q-item-section>
                      <q-item-label>{{ event.group.name }}</q-item-label>
                      <q-item-label caption>Event Organizer</q-item-label>
                      <q-item-label overline>{{ event.group.visibility }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </div>
              </q-card-section>
            </q-card>
            <!-- Details section -->
            <q-card class="q-mt-lg">
              <q-card-section>
                <q-item>
                  <q-item-section side>
                    <q-icon name="sym_r_schedule"/>
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ formatDate(event.startDate) }}</q-item-label>
                    <q-item-label v-if="event.endDate">{{ formatDate(event.endDate) }}</q-item-label>
                  </q-item-section>
                </q-item>
                <q-item>
                  <q-item-section side>
                    <q-icon label="In person" v-if="event.type === 'in-person'" icon="sym_r_person_pin_circle"
                            name="sym_r_person_pin_circle"/>
                    <q-icon label="Online" v-if="event.type === 'online'" name="sym_r_videocam"/>
                    <q-icon label="Hybrid" v-if="event.type === 'hybrid'" name="sym_r_diversity_2"/>
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ event.type }} event</q-item-label>
                    <q-btn no-caps size="md" align="left" flat padding="none" target="_blank" :href="event.locationOnline">Online link</q-btn>
                    <q-item-label class="cursor-pointer">
                      {{ event.location }}
                      <q-popup-proxy>
                        <q-card class="q-pa-md" style="height: 500px; width: 500px">
                          <LeafletMapComponent disabled style="height: 300px; width: 300px" :lat="event.lat" :lon="event.lon"/>
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
    </div>
    <EventStickyComponent v-if="event" :event="event" style="z-index: 1000"/>
    <NoContentComponent v-if="errorMessage" :label="errorMessage" icon="sym_r_warning" @click="router.push({ name: 'EventsPage' })" button-label="Back to events"/>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Dark, LoadingBar } from 'quasar'
import { useNotification } from 'src/composables/useNotification.ts'
import { getImageSrc } from 'src/utils/imageUtils.ts'
import EventStickyComponent from 'components/event/EventStickyComponent.vue'
import { formatDate } from '../utils/dateUtils.ts'
import LeafletMapComponent from 'components/common/LeafletMapComponent.vue'
import MenuItemComponent from 'components/common/MenuItemComponent.vue'
import { useEventDialog } from 'src/composables/useEventDialog.ts'
import EventLeadComponent from 'components/event/EventLeadComponent.vue'
import { useEventStore } from 'stores/event-store.ts'
import { decodeLowercaseStringToNumber, encodeNumberToLowercaseString } from 'src/utils/encoder.ts'
import SpinnerComponent from 'components/common/SpinnerComponent.vue'
import NoContentComponent from 'components/global/NoContentComponent.vue'

const route = useRoute()
const router = useRouter()
const { success } = useNotification()
const { openDeleteEventDialog, openCancelEventDialog } = useEventDialog()
const event = computed(() => useEventStore().event)
const errorMessage = computed(() => useEventStore().errorMessage)
const loaded = ref<boolean>(false)
const onDeleteEvent = () => {
  if (event.value) openDeleteEventDialog(event.value)
}

const onCancelEvent = () => {
  if (event.value) openCancelEventDialog(event.value)
}

const rsvpToEvent = () => {
  if (event.value) {
    // Here you would typically make an API call to RSVP
    // For this example, we'll just update the local state
    event.value.attendeesCount = event.value.attendeesCount ? event.value.attendeesCount++ : 1
    success('You have successfully RSVP\'d to this event!')
  }
}

onMounted(() => {
  LoadingBar.start()
  const eventId = decodeLowercaseStringToNumber(route.params.id as string)
  useEventStore().actionGetEventById(String(eventId)).finally(() => {
    loaded.value = true
    LoadingBar.stop()
  })
})
</script>
