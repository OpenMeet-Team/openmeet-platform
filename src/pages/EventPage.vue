<template>
  <q-page class="q-pa-md q-pb-xl" style="padding-bottom: 110px">
    <SpinnerComponent v-if="!loaded"/>
    <div v-else-if="event">

      <!-- Title -->
      <div :class="[Dark.isActive ? 'bg-dark' : 'bg-white']" class="text-h4 text-bold bg-inherit q-py-sm">{{ event.name }}</div>

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

          <div v-if="event?.attendees?.length" class="q-mt-lg text-h5 row items-center justify-between"><span>Attendees <span v-if="event?.attendees?.length">({{ event?.attendees?.length }})</span></span> <q-btn v-if="event.attendees?.length" padding="xs" no-caps flat label="See all">
            <q-popup-proxy @before-show="useEventStore().actionGetEventAttendeesById(String(decodeLowercaseStringToNumber(route.params.id as string)))">
              <h2>Attendees here</h2>
              TODO

              {{ event.attendees }}
            </q-popup-proxy>
          </q-btn></div>
          <q-card>
            <q-card class="shadow-1">
              <div class="row q-gutter-md">
                <q-item v-for="attendee of event.attendees" :key="attendee.id">
                  <q-avatar avatar>
                    <q-img v-if="attendee.user?.photo" :src="getImageSrc(attendee.user.photo)" :ratio="1"/>
                    <q-icon v-else name="sym_r_person"/>
                  </q-avatar>
                </q-item>
              </div>
            </q-card>
          </q-card>
        </div>
        <div class="col-12 col-md-4">
          <div style="position: sticky; top: 70px">
            <q-card class="q-mb-md shadow-0" v-if="useEventStore().getterEventHasHostRole()">
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
            <q-card class="q-mb-md" v-if="event?.group">
              <q-card-section>
                <div class="text-h6">Organizer</div>
                <div class="q-mt-md">
                  <q-item clickable @click="navigateToGroup(event.group.slug, event.group.id)">
                    <q-item-section avatar>
                      <q-avatar size="48px">
                        <img v-if="event.group.image" :src="getImageSrc(event.group.image)" :alt="event.group.name">
                        <q-icon v-else name="sym_r_group"/>
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
            <q-card class="q-mb-lg">
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
<!--              <LeafletMapComponent v-if="event" disabled style="height: 300px; width: 300px" :lat="event.lat" :lon="event.lon"/>-->
            </q-card>
          </div>
        </div>
      </div>

      <GroupSimilarEventsComponent/>
    </div>
    <EventStickyComponent v-if="event" :event="event" style="z-index: 1000"/>
    <NoContentComponent v-if="errorMessage" :label="errorMessage" icon="sym_r_warning" @click="router.push({ name: 'EventsPage' })" button-label="Back to events"/>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Dark, LoadingBar, useMeta } from 'quasar'
// import { useNotification } from 'src/composables/useNotification.ts'
import { getImageSrc } from 'src/utils/imageUtils.ts'
import EventStickyComponent from 'components/event/EventStickyComponent.vue'
import { formatDate } from '../utils/dateUtils.ts'
import LeafletMapComponent from 'components/common/LeafletMapComponent.vue'
import MenuItemComponent from 'components/common/MenuItemComponent.vue'
import { useEventDialog } from 'src/composables/useEventDialog.ts'
import EventLeadComponent from 'components/event/EventLeadComponent.vue'
import { useEventStore } from 'stores/event-store.ts'
import { decodeLowercaseStringToNumber } from 'src/utils/encoder.ts'
import SpinnerComponent from 'components/common/SpinnerComponent.vue'
import NoContentComponent from 'components/global/NoContentComponent.vue'
import GroupSimilarEventsComponent from 'components/group/GroupSimilarEventsComponent.vue'
import { useNavigation } from 'src/composables/useNavigation.ts'

const route = useRoute()
const router = useRouter()
const { navigateToGroup } = useNavigation()
// const { success } = useNotification()
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

// const rsvpToEvent = () => {
//   if (event.value) {
//     // Here you would typically make an API call to RSVP
//     // For this example, we'll just update the local state
//     event.value.attendeesCount = event.value.attendeesCount ? event.value.attendeesCount++ : 1
//     success('You have successfully RSVP\'d to this event!')
//   }
// }

onMounted(() => {
  LoadingBar.start()
  const eventId = decodeLowercaseStringToNumber(route.params.id as string)
  useEventStore().actionGetEventById(String(eventId)).finally(() => {
    loaded.value = true
    LoadingBar.stop()
  }).then(() => {
    useMeta({
      title: event.value?.name,
      meta: {
        description: { content: event.value?.description },
        'og:image': { content: getImageSrc(event.value?.image) }
      }
    })
  })
})
</script>
