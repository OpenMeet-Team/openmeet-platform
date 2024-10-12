<template>
  <q-page class="q-pa-md">
    <div v-if="event" class="row q-col-gutter-md">
      <div class="col-12 col-md-8">
        <q-card>
          <q-img :src="getImageSrc(event.image)" :ratio="16/9">
            <div class="absolute-bottom text-subtitle1 text-center bg-black-4 full-width">
              {{ event.name }}
            </div>
          </q-img>

          <q-card-section>
            <div class="text-h4">{{ event.name }}</div>
            <div class="text-subtitle1 q-mt-sm" v-if="event.startDate">
              <q-icon name="sym_r_event" /> {{ formatDate(event.startDate) }}
            </div>
            <div class="text-subtitle1" v-if="event.location">
              <q-icon name="sym_r_place" /> {{ event.location }}
            </div>
          </q-card-section>

          <q-card-section v-if="event.description">
            <div class="text-body1">{{ event.description }}</div>
          </q-card-section>

          <q-card-section>
            <div class="text-h6">Attendees</div>
            <q-linear-progress v-if="event.attendeesCount && event.maxAttendees"
              :value="event.attendeesCount / event.maxAttendees"
              color="secondary"
              class="q-mt-sm"
            />
            <div class="text-caption q-mt-sm">
              {{ event.attendeesCount }} <span v-if="event.maxAttendees">/ {{ event.maxAttendees }}</span> spots filled
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
        <q-card class="q-mb-md">
          <q-card-section>
            <q-btn-dropdown align="center" no-caps label="Organiser tools">
              <q-list>
                <MenuItemComponent label="Manage Event" icon="sym_r_edit_note" @click="$router.push({ name: 'DashboardEventGeneralPage', params: { id: $route.params.id }})"/>
                <MenuItemComponent label="Manage attendees" icon="sym_r_people" @click="$router.push({ name: 'DashboardEventAttendeesPage', params: { id: $route.params.id }})"/>
                <q-separator/>
                <MenuItemComponent label="Delete event" icon="sym_r_delete"/>
              </q-list>
            </q-btn-dropdown>
          </q-card-section>
        </q-card>
        <q-card>
          <q-card-section>
            <div class="text-h6">Organizer</div>
            <div class="q-mt-md">
              <q-item>
                <q-item-section avatar>
                  <q-avatar>
                    <img src="https://cdn.quasar.dev/img/boy-avatar.png">
                  </q-avatar>
                </q-item-section>
                <q-item-section>
                  <q-item-label>John Doe</q-item-label>
                  <q-item-label caption>Event Organizer</q-item-label>
                </q-item-section>
              </q-item>
            </div>
          </q-card-section>
        </q-card>

        <q-card class="q-mt-md" style="height: 500px">
          <LeafletMapComponent disabled style="height: 300px; width: 300px" :lat="event.lat" :lon="event.lon"/>
        </q-card>
      </div>
    </div>
    <EventStickyComponent v-if="event" :event="event"/>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { LoadingBar } from 'quasar'
import { eventsApi } from 'src/api/events.ts'
import { EventEntity } from 'src/types'
import { useNotification } from 'src/composables/useNotification.ts'
import { getImageSrc } from 'src/utils/imageUtils.ts'
import EventStickyComponent from 'components/event/EventStickyComponent.vue'
import { formatDate } from '../utils/dateUtils.ts'
import LeafletMapComponent from 'components/common/LeafletMapComponent.vue'
import MenuItemComponent from 'components/common/MenuItemComponent.vue'

const route = useRoute()
const { success } = useNotification()

const event = ref<EventEntity | null>(null)

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
  eventsApi.getById(route.params.id as string).finally(LoadingBar.stop).then(res => {
    event.value = res.data
  })
})
</script>
