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
          <DashboardEventItem v-for="event in createdEvents" :key="event.id" :event="event" @view="viewEvent" @edit="editEvent" />
        </div>
      </q-tab-panel>

      <q-tab-panel name="attended">
        <div class="row q-gutter-md">
          <DashboardEventItem v-for="event in attendedEvents" :key="event.id" :event="event" @view="viewEvent" />
        </div>
      </q-tab-panel>
    </q-tab-panels>

    <q-dialog v-model="eventDialog" persistent>
      <q-card style="min-width: 350px">
        <q-card-section>
          <div class="text-h6">{{ selectedEvent.name }}</div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          Date: {{ selectedEvent.startDate }}<br>
          Location: {{ selectedEvent.location }}<br>
          Description: {{ selectedEvent.description }}
        </q-card-section>

        <q-card-actions align="right" class="text-primary">
          <q-btn flat label="Close" v-close-popup />
          <q-btn flat label="Edit" v-if="tab === 'created'" @click="editEvent(selectedEvent.id)" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { LoadingBar } from 'quasar'
import DashboardEventItem from 'components/dashboard/DashboardEventItem.vue'
import { useRouter } from 'vue-router'
import { apiGetDashboardEvents } from 'src/api/dashboard.ts'
import { EventData } from 'src/types'

const tab = ref<'created' | 'attended'>('created')
const eventDialog = ref(false)
const selectedEvent = ref<EventData>({} as EventData)
const router = useRouter()

// Mock data - replace with actual API calls
const createdEvents = computed(() => events.value)
const attendedEvents = computed(() => events.value)

const events = ref<EventData[]>([])

const viewEvent = (event: EventData) => {
  selectedEvent.value = event
  eventDialog.value = true
}

const editEvent = (eventId: number) => {
  router.push({ name: 'DashboardEventPage', params: { id: eventId } })
}

onMounted(() => {
  LoadingBar.start()
  apiGetDashboardEvents().then(res => {
    events.value = res.data
  }).finally(LoadingBar.stop)
})

const onAddNewEvent = () => {
  router.push({ name: 'DashboardEventCreatePage' })
}
</script>
