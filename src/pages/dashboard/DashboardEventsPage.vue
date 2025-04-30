<template>
  <q-page padding style="max-width: 1024px" class="q-mx-auto" v-if="loaded">

    <div class="row justify-between items-start">
      <DashboardTitle defaultBack label="Your events" />
      <q-btn no-caps color="primary" icon="sym_r_add" label="Add New Event" @click="onAddNewEvent" />
    </div>

    <q-tabs align="left" no-caps v-model="tab" class="text-primary q-mb-md q-mt-md">
      <q-tab name="attending" label="Attending Events" />
      <q-tab name="hosting" label="Hosting Events" />
      <!-- <q-tab name="saved" label="Saved Events"/> -->
      <q-tab name="past" label="Past Events" />
    </q-tabs>

    <q-tab-panels v-model="tab" animated>
      <q-tab-panel name="attending">
        <NoContentComponent v-if="attendedEvents && !attendedEvents.length" @click="router.push({ name: 'EventsPage' })"
          buttonLabel="Discover new events" label="You have not registered for any events" icon="sym_r_event" />
        <div>
          <EventsItemComponent v-for="event in attendedEvents" :key="event.id" :event="event" layout="list"/>
        </div>
      </q-tab-panel>
      <q-tab-panel name="hosting">
        <template v-if="hostingEvents && !hostingEvents.length">
          <NoContentComponent @click="onAddNewEvent" buttonLabel="Add new Event and select a group to get started."
            label="You are not hosting any upcoming events" icon="sym_r_app_registration" />
        </template>
        <div v-else>
          <EventsItemComponent v-for="event in hostingEvents" :key="event.id" :event="event" layout="list"/>
        </div>
      </q-tab-panel>

      <q-tab-panel name="past">

        <div v-if="pastEvents?.length">
          <EventsItemComponent v-for="event in pastEvents" :key="event.id" :event="event" layout="list"/>
        </div>
        <NoContentComponent v-if="events && !pastEvents.length" @click="router.push({ name: 'EventsPage' })"
          buttonLabel="Discover new events" label="You have not attended any events" icon="sym_r_timeline" />
      </q-tab-panel>
    </q-tab-panels>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { LoadingBar, useMeta } from 'quasar'
import { useRouter } from 'vue-router'
import { EventAttendeeRole, EventEntity } from '../../types'
import EventsItemComponent from '../../components/event/EventsItemComponent.vue'
import DashboardTitle from '../../components/dashboard/DashboardTitle.vue'
import { eventsApi } from '../../api'

const tab = ref<'attending' | 'hosting' | 'saved' | 'past'>('attending')
const loaded = ref<boolean>(false)
const router = useRouter()

// Fix: Properly filter hosting events by role name
const hostingEvents = computed(() => events.value.filter(event => event.attendee?.role.name === EventAttendeeRole.Host))
// Fix: Properly filter attended events by role name (not being host) and only future events
const attendedEvents = computed(() => events.value.filter(event =>
  event.attendee &&
  event.attendee.role.name !== EventAttendeeRole.Host &&
  event.startDate &&
  new Date(event.startDate) >= new Date()
))
// const savedEvents = computed(() => events.value)
const pastEvents = computed(() => events.value.filter(event => event.startDate && new Date(event.startDate) < new Date()))
const events = ref<EventEntity[]>([])

useMeta({
  title: 'Your events'
})

onMounted(() => {
  LoadingBar.start()
  eventsApi.getDashboardEvents().then(res => {
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
