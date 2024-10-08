<template>
  <q-page padding>

    <DashboardTitle label="My Events">
      <q-btn
        no-caps
        color="primary"
        icon="sym_r_add"
        label="Add New Event"
        @click="onAddNewEvent"
      />
    </DashboardTitle>

    <q-tabs align="left" no-caps v-model="tab" class="text-primary q-mb-md">
      <q-tab name="created" label="Created Events" />
      <q-tab name="attended" label="Attended Events" />
    </q-tabs>

    <q-tab-panels v-model="tab" animated>
      <q-tab-panel name="created">
        <div class="row q-gutter-md">
          <DashboardEventItem v-for="event in createdEvents" :key="event.id" :event="event" @view="viewEvent" @delete="onDeleteEvent" @edit="editEvent" />
        </div>
      </q-tab-panel>

      <q-tab-panel name="attended">
        <div class="row q-gutter-md">
          <DashboardEventItem v-for="event in attendedEvents" :key="event.id" :event="event" @view="viewEvent" />
        </div>
      </q-tab-panel>
    </q-tab-panels>
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { LoadingBar } from 'quasar'
import DashboardEventItem from 'components/dashboard/DashboardEventItem.vue'
import { useRouter } from 'vue-router'
import { apiGetDashboardEvents } from 'src/api/dashboard.ts'
import { EventEntity } from 'src/types'
import { useEventDialog } from 'src/composables/useEventDialog.ts'
import DashboardTitle from 'components/dashboard/DashboardTitle.vue'

const tab = ref<'created' | 'attended'>('created')
const router = useRouter()
const { openDeleteEventDialog } = useEventDialog()

// Mock data - replace with actual API calls
const createdEvents = computed(() => events.value)
const attendedEvents = computed(() => events.value)

const events = ref<EventEntity[]>([])

const viewEvent = (event: EventEntity) => {
  router.push({ name: 'EventPage', params: { id: event.id } })
}

const editEvent = (eventId: number) => {
  router.push({ name: 'DashboardEventPage', params: { id: eventId } })
}

const onDeleteEvent = (event: EventEntity) => {
  openDeleteEventDialog(event)
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
