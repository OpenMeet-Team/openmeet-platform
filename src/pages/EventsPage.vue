<template>
  <q-page class="q-pa-md">
    <h1 class="text-h4 q-mb-md">Upcoming Events</h1>
    <div class="row q-col-gutter-md">
      <div v-for="event in events" :key="event.id" class="col-12 col-sm-6 col-md-4">
        <q-card class="event-card">
          <q-img :src="event.image as string || 'https://via.placeholder.com/350'" basic>
            <div class="absolute-bottom text-subtitle2 text-center">
              {{ formatDate(event.startDate) }}
            </div>
          </q-img>

          <q-card-section>
            <div class="text-h6">{{ event.name }}</div>
            <div class="text-subtitle2">{{ event.location }}</div>
            <div class="text-subtitle2">{{ event.type }}</div>
          </q-card-section>

          <q-card-section class="q-pt-none" v-if="event.description">
            {{ truncateDescription(event.description) }}
          </q-card-section>

          <q-card-section class="text-subtitle2">
            <q-icon name="sym_r_people" /> {{ event.attendees }} / {{ event.maxAttendees }} attendees
          </q-card-section>

          <q-separator />

          <q-card-actions align="right">
            <q-btn flat color="primary" label="View Details" @click="viewEventDetails(event.id)" />
            <q-btn flat color="secondary" label="RSVP" @click="rsvpToEvent(event.id)" />
          </q-card-actions>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { date, LoadingBar } from 'quasar'
import { useRouter } from 'vue-router'
import { eventsApi } from 'src/api/events.ts'
import { EventData } from 'src/types'

const router = useRouter()

const events = ref<EventData[]>([])
const formatDate = (dateString: string) => {
  return date.formatDate(dateString, 'MMMM D, YYYY')
}

const truncateDescription = (description: string, length: number = 100) => {
  return description.length > length
    ? description.substring(0, length) + '...'
    : description
}

const viewEventDetails = (eventId: number) => {
  router.push({ name: 'EventPage', params: { id: eventId } })
}

const rsvpToEvent = (eventId: number) => {
  // Implement RSVP functionality
  console.log('RSVP to event:', eventId)
}

onMounted(() => {
  LoadingBar.start()
  eventsApi.getAll().finally(LoadingBar.stop).then(res => {
    events.value = res.data
  })
})
</script>

<style scoped>
.event-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.event-card .q-card__section:nth-last-child(2) {
  flex-grow: 1;
}
</style>
