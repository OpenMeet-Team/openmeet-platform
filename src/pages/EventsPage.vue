<template>
  <q-page class="q-pa-md">
    <h1 class="text-h4 q-mb-md">Upcoming Events</h1>
    <div class="row q-col-gutter-md">
      <div v-for="event in events" :key="event.id" class="col-12 col-sm-6 col-md-4">
        <q-card class="event-card">
          <q-img
            :src="event.imageUrl || 'https://cdn.quasar.dev/img/parallax2.jpg'"
            basic
          >
            <div class="absolute-bottom text-subtitle2 text-center">
              {{ formatDate(event.date) }}
            </div>
          </q-img>

          <q-card-section>
            <div class="text-h6">{{ event.title }}</div>
            <div class="text-subtitle2">{{ event.location }}</div>
          </q-card-section>

          <q-card-section class="q-pt-none">
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

const router = useRouter()

interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  maxAttendees: number;
  attendees: number;
  imageUrl?: string;
}

// Sample events data
const events = ref<Event[]>([
  {
    id: '1',
    title: 'Tech Meetup 2023',
    description: 'Join us for an exciting tech meetup where we\'ll discuss the latest trends in web development and AI.',
    date: '2023-07-15',
    time: '18:00',
    location: 'Tech Hub, Downtown',
    maxAttendees: 100,
    attendees: 75,
    imageUrl: 'https://cdn.quasar.dev/img/mountains.jpg'
  },
  {
    id: '2',
    title: 'Startup Networking Event',
    description: 'Connect with fellow entrepreneurs and investors in this networking event for startups.',
    date: '2023-07-22',
    time: '19:30',
    location: 'Innovate Co-working Space',
    maxAttendees: 50,
    attendees: 30
  }
  // Add more events as needed
])

const formatDate = (dateString: string) => {
  return date.formatDate(dateString, 'MMMM D, YYYY')
}

const truncateDescription = (description: string, length: number = 100) => {
  return description.length > length
    ? description.substring(0, length) + '...'
    : description
}

const viewEventDetails = (eventId: string) => {
  // Implement navigation to event details page
  console.log('View details for event:', eventId)
  router.push({ name: 'EventPage', params: { id: 'some-event-id' } })
}

const rsvpToEvent = (eventId: string) => {
  // Implement RSVP functionality
  console.log('RSVP to event:', eventId)
}

onMounted(() => {
  LoadingBar.start()
  eventsApi.getAll().finally(LoadingBar.stop)
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
