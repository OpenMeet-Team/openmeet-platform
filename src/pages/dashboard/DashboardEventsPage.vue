<template>
  <q-page padding>
    <div class="row items-center justify-between q-mb-lg">
      <h1 class="text-h4 q-my-none">My Events</h1>
      <q-btn
        no-caps
        color="primary"
        icon="sym_r_add"
        label="Add New Event"
        @click="onAddNewEvent"
      />
    </div>

    <q-tabs no-caps v-model="tab" class="text-primary q-mb-md">
      <q-tab name="created" label="Created Events" />
      <q-tab name="attended" label="Attended Events" />
    </q-tabs>

    <q-tab-panels v-model="tab" animated>
      <q-tab-panel name="created">
        <div class="row q-gutter-md">
          <DashboardEventItem v-for="event in createdEvents" :key="event.id" :event="event" @view-event="viewEvent" />
        </div>
      </q-tab-panel>

      <q-tab-panel name="attended">
        <div class="row q-gutter-md">
          <DashboardEventItem v-for="event in attendedEvents" :key="event.id" :event="event" @view-event="viewEvent" />
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
import { onMounted, ref } from 'vue'
import { LoadingBar, useQuasar } from 'quasar'
import DashboardEventItem from 'components/dashboard/DashboardEventItem.vue'
import { EventData } from 'src/types'
import { useRouter } from 'vue-router'
import { apiGetDashboardEvents } from 'src/api/dashboard.ts'

const $q = useQuasar()
const tab = ref<'created' | 'attended'>('created')
const eventDialog = ref(false)
const selectedEvent = ref<EventData>({} as EventData)
const router = useRouter()

// Mock data - replace with actual API calls
const createdEvents = ref<EventData[]>([
  { id: 1, title: 'Team Building Workshop', date: '2024-10-15', location: 'Conference Room A', description: 'A workshop to improve team collaboration.' },
  { id: 2, title: 'Product Launch', date: '2024-11-20', location: 'Main Auditorium', description: 'Launching our new product line.' }
])

const attendedEvents = ref<EventData[]>([
  { id: 3, title: 'Annual Conference', date: '2024-09-05', location: 'Convention Center', description: 'Our company\'s annual gathering.' },
  { id: 4, title: 'Charity Fundraiser', date: '2024-12-01', location: 'City Park', description: 'Raising funds for local charities.' }
])

const viewEvent = (event: EventData) => {
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

onMounted(() => {
  LoadingBar.start()
  apiGetDashboardEvents().then(() => {
    // TODO set events
  }).finally(LoadingBar.stop)
})

const onAddNewEvent = () => {
  router.push({ name: 'DashboardEventsCreate' })
}
</script>
