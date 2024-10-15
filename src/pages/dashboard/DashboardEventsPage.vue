<template>
  <q-page padding v-if="loaded">

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
      <q-tab name="attending" label="Attending Events" />
      <q-tab name="hosting" label="Hosting Events" />
      <q-tab name="saved" label="Saved Events" />
      <q-tab name="past" label="Past Events" />
    </q-tabs>

    <q-tab-panels v-model="tab" animated>
      <q-tab-panel name="hosting">
        <template v-if="createdEvents && !createdEvents.length">
          <NoContentComponent  @click="onAddNewEvent" buttonLabel="Add new Event and select a group to get started." label="You are not hosting any upcoming events" icon="sym_r_app_registration"/>
        </template>
        <div v-else class="row q-gutter-md">
          <DashboardEventItem v-for="event in createdEvents" :key="event.id" :event="event" @view="viewEvent" @delete="onDeleteEvent" @edit="editEvent" />
        </div>
      </q-tab-panel>

      <q-tab-panel name="attending">
        <NoContentComponent v-if="attendedEvents && !attendedEvents.length" @click="router.push({ name: 'EventsPage' })" buttonLabel="Discover new events" label="You have not registered for any events" icon="sym_r_event"/>
        <div class="row q-gutter-md">
          <DashboardEventItem v-for="event in attendedEvents" :key="event.id" :event="event" @view="viewEvent" />
        </div>
      </q-tab-panel>

      <q-tab-panel name="saved">
        <NoContentComponent v-if="savedEvents && !savedEvents.length" @click="router.push({ name: 'EventsPage' })" buttonLabel="Discover new events" label="You have not saved any events" icon="sym_r_bookmarks"/>
        <div class="row q-gutter-md">
          <DashboardEventItem v-for="event in savedEvents" :key="event.id" :event="event" @view="viewEvent" />
        </div>
      </q-tab-panel>

      <q-tab-panel name="past">
        <NoContentComponent v-if="savedEvents && !savedEvents.length" @click="router.push({ name: 'EventsPage' })" buttonLabel="Discover new events" label="You have not attended any events" icon="sym_r_timeline"/>
        <div class="row q-gutter-md">
          <DashboardEventItem v-for="event in savedEvents" :key="event.id" :event="event" @view="viewEvent" />
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

const tab = ref<'attending' | 'hosting' | 'saved' | 'past'>('attending')
const loaded = ref<boolean>(false)
const router = useRouter()
const { openDeleteEventDialog } = useEventDialog()

// Mock data - replace with actual API calls
const createdEvents = computed(() => events.value)
const attendedEvents = computed(() => events.value)
const savedEvents = computed(() => events.value)

const events = ref<EventEntity[]>([])

const viewEvent = (event: EventEntity) => {
  router.push({ name: 'EventPage', params: { id: event.id } })
}

const editEvent = (eventId: number) => {
  router.push({ name: 'DashboardEventGeneralPage', params: { id: eventId } })
}

const onDeleteEvent = (event: EventEntity) => {
  openDeleteEventDialog(event)
}

onMounted(() => {
  LoadingBar.start()
  apiGetDashboardEvents().then(res => {
    events.value = res.data
  }).finally(() => {
    LoadingBar.stop()
    loaded.value = true
  })
})

const onAddNewEvent = () => {
  router.push({ name: 'DashboardEventCreatePage' })
}
</script>
