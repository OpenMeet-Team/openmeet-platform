<template>
  <div class="q-pa-md">
    <div class="row q-mb-md">
      <q-btn-toggle
        v-model="viewMode"
        flat
        stretch
        toggle-color="primary"
        :options="[
          {label: 'List', value: 'list', icon: 'sym_r_list'},
          {label: 'Calendar', value: 'calendar', icon: 'sym_r_event'}
        ]"
      />
    </div>

    <div class="row q-mb-md">
      <q-btn-toggle
        v-model="timeFilter"
        flat
        stretch
        toggle-color="primary"
        :options="[
          {label: 'Upcoming', value: 'upcoming'},
          {label: 'Past', value: 'past'}
        ]"
      />
    </div>

    <div v-if="viewMode === 'list'">
      <q-list bordered separator v-if="filteredEvents.length">
        <q-item v-for="event in filteredEvents" :key="event.id" class="q-my-sm">
          <q-item-section>
            <q-item-label class="text-primary">{{ formatDate(event.date) }}</q-item-label>
            <q-item-label class="text-h6">{{ event.title }}</q-item-label>
            <q-item-label caption>{{ event.type }}</q-item-label>
            <q-item-label caption>{{ event.description }}</q-item-label>
            <div class="row items-center q-gutter-sm">
              <q-icon name="sym_r_people" size="xs" />
              <span>{{ event.attendees }} {{ event.attendees === 1 ? 'attendee' : 'attendees' }}</span>
            </div>
          </q-item-section>
          <q-item-section side>
            <q-btn color="primary" label="Attend" @click="attendEvent(event.id)" />
          </q-item-section>
        </q-item>
      </q-list>
      <NoContentComponent v-else label="No events found" icon="sym_r_event_busy"/>
    </div>

    <div v-else>
      <CalendarComponent
        mode="month"
        :day-height="100"
        :model-value="selectedDate"
        view="month"
        :events="calendarEvents"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { date } from 'quasar'
import CalendarComponent from 'components/common/CalendarComponent.vue'

interface Event {
  id: number
  title: string
  date: string
  type: string
  description: string
  attendees: number
}

const events = ref<Event[]>([
  {
    id: 1,
    title: 'Real Estate Investing Overview',
    date: '2024-10-17T18:00:00',
    type: 'Zoom',
    description: 'Are you interested getting involved in Real Estate Investing but don\'t know where to start?',
    attendees: 1
  },
  {
    id: 2,
    title: 'REI Flip/Hold/STR Property Tour',
    date: '2024-10-19T10:00:00',
    type: 'Zoom',
    description: 'Join us Saturday from 10:00 AM to 11:00 AM where you can learn projects in different states, each unique',
    attendees: 1
  }
  // Add more events as needed
])

const viewMode = ref<'list' | 'calendar'>('list')
const timeFilter = ref<'upcoming' | 'past'>('upcoming')
const selectedDate = ref(null)

const filteredEvents = computed(() => {
  const now = new Date()
  return events.value.filter(event => {
    const eventDate = new Date(event.date)
    return timeFilter.value === 'upcoming' ? eventDate >= now : eventDate < now
  })
})

const calendarEvents = computed(() => {
  return events.value.map(event => ({
    title: event.title,
    date: event.date,
    bgcolor: 'primary'
  }))
})

const formatDate = (dateString: string) => {
  return date.formatDate(dateString, 'ddd, MMM D, YYYY, h:mm A')
}

const attendEvent = (eventId: number) => {
  console.log(`Attending event with id: ${eventId}`)
  // Implement attendance logic here
}
</script>
