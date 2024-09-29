<template>
  <q-page class="q-pa-md">
    <div v-if="event" class="row q-col-gutter-md">
      <div class="col-12 col-md-8">
        <q-card>
          <q-img
            :src="event.imageUrl || 'https://cdn.quasar.dev/img/parallax2.jpg'"
            :ratio="16/9"
          >
            <div class="absolute-bottom text-subtitle1 text-center bg-black-4 full-width">
              {{ event.title }}
            </div>
          </q-img>

          <q-card-section>
            <div class="text-h4">{{ event.title }}</div>
            <div class="text-subtitle1 q-mt-sm">
              <q-icon name="sym_r_event" /> {{ formatDate(event.date) }} at {{ event.time }}
            </div>
            <div class="text-subtitle1">
              <q-icon name="sym_r_place" /> {{ event.location }}
            </div>
          </q-card-section>

          <q-card-section>
            <div class="text-body1">{{ event.description }}</div>
          </q-card-section>

          <q-card-section>
            <div class="text-h6">Attendees</div>
            <q-linear-progress
              :value="event.attendees / event.maxAttendees"
              color="secondary"
              class="q-mt-sm"
            />
            <div class="text-caption q-mt-sm">
              {{ event.attendees }} / {{ event.maxAttendees }} spots filled
            </div>
          </q-card-section>

          <q-card-actions align="right">
            <q-btn
              color="primary"
              label="RSVP"
              @click="rsvpToEvent"
              :disable="event.attendees >= event.maxAttendees"
            />
          </q-card-actions>
        </q-card>
      </div>

      <div class="col-12 col-md-4">
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

        <q-card class="q-mt-md">
          <q-card-section>
            <div class="text-h6">Location</div>
            <div class="q-mt-md">
              <q-img
                src="https://cdn.quasar.dev/img/map.png"
                :ratio="16/9"
              />
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <div v-else class="text-center q-mt-xl">
      <q-spinner-dots color="primary" size="3em" />
      <div class="text-h6 q-mt-md">Loading event details...</div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { date, useQuasar } from 'quasar'

interface Event {
  id: number;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  maxAttendees: number;
  attendees: number;
  imageUrl?: string;
}

const route = useRoute()
const $q = useQuasar()

const event = ref<Event | null>(null)

const formatDate = (dateString: string) => {
  return date.formatDate(dateString, 'MMMM D, YYYY')
}

const rsvpToEvent = () => {
  if (event.value) {
    // Here you would typically make an API call to RSVP
    // For this example, we'll just update the local state
    event.value.attendees++

    $q.notify({
      color: 'positive',
      textColor: 'white',
      icon: 'check_circle',
      message: 'You have successfully RSVP\'d to this event!'
    })
  }
}

onMounted(async () => {
  const eventId = parseInt(route.params.id as string)

  // Simulating an API call to fetch event details
  await new Promise(resolve => setTimeout(resolve, 1000))

  // Mock event data (in a real app, this would come from an API)
  event.value = {
    id: eventId,
    title: 'Tech Meetup 2024',
    description: 'Join us for an exciting tech meetup where we\'ll discuss the latest trends in web development and AI. This event will feature keynote speakers from leading tech companies, interactive workshops, and networking opportunities. Whether you\'re a seasoned developer or just starting out, this meetup offers valuable insights and connections in the ever-evolving world of technology.',
    date: '2024-12-15',
    time: '18:00',
    location: 'Tech Hub, 123 Innovation Street, Silicon Valley, CA',
    maxAttendees: 100,
    attendees: 75,
    imageUrl: 'https://cdn.quasar.dev/img/mountains.jpg'
  }
})
</script>
