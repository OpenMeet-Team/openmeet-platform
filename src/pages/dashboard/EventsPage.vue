<template>
  <q-page padding>
    <h1 class="text-h4 q-mb-md">My Events</h1>

    <q-tabs
      v-model="tab"
      class="text-primary q-mb-md"
    >
      <q-tab name="created" label="Created Events" />
      <q-tab name="attended" label="Attended Events" />
    </q-tabs>

    <q-tab-panels v-model="tab" animated>
      <q-tab-panel name="created">
        <div class="row q-gutter-md">
          <DashboardEventList v-for="event in createdEvents" :key="event.id" :event="event" @view-event="viewEvent" />
        </div>
      </q-tab-panel>

      <q-tab-panel name="attended">
        <div class="row q-gutter-md">
          <DashboardEventList v-for="event in attendedEvents" :key="event.id" :event="event" @view-event="viewEvent" />
        </div>
      </q-tab-panel>
    </q-tab-panels>

    <q-dialog v-model="eventDialog" persistent>
      <q-card style="min-width: 350px">
        <q-card-section>
          <div class="text-h6">{{ selectedEvent.title }}</div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          Date: {{ selectedEvent.date }}<br>
          Location: {{ selectedEvent.location }}<br>
          Description: {{ selectedEvent.description }}
        </q-card-section>

        <q-card-actions align="right" class="text-primary">
          <q-btn flat label="Close" v-close-popup />
          <q-btn flat label="Edit" v-if="tab === 'created'" @click="editEvent" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useQuasar } from 'quasar'
import DashboardEventList from 'src/components/dashboard/DashboardEventList.vue'
import { Event } from 'components/models.ts'

const $q = useQuasar()
const tab = ref<'created' | 'attended'>('created')
const eventDialog = ref(false)
const selectedEvent = ref<Event>({} as Event)

// Mock data - replace with actual API calls
const createdEvents = ref<Event[]>([
  { id: 1, title: 'Team Building Workshop', date: '2024-10-15', location: 'Conference Room A', description: 'A workshop to improve team collaboration.' },
  { id: 2, title: 'Product Launch', date: '2024-11-20', location: 'Main Auditorium', description: 'Launching our new product line.' }
])

const attendedEvents = ref<Event[]>([
  { id: 3, title: 'Annual Conference', date: '2024-09-05', location: 'Convention Center', description: 'Our company\'s annual gathering.' },
  { id: 4, title: 'Charity Fundraiser', date: '2024-12-01', location: 'City Park', description: 'Raising funds for local charities.' }
])

const viewEvent = (event: Event) => {
  selectedEvent.value = event
  eventDialog.value = true
}

const editEvent = () => {
  // Implement edit functionality
  $q.notify({
    message: 'Edit functionality to be implemented',
    color: 'info'
  })
}
</script>
