<template>
  <q-page padding>
    <div class="row q-mb-xl">
      <h1 class="text-h4 q-my-none">Create New Event</h1>
    </div>

    <EventFormComponent @created="onEventCreated" style="max-width: 500px">
      <div class="row justify-end q-gutter-md">
        <q-btn flat label="Cancel" :to="{ name: 'DashboardEventsPage' }"/>
        <q-btn label="Create Event" type="submit" color="primary"/>
      </div>
    </EventFormComponent>
  </q-page>
</template>

<script setup lang="ts">
import EventFormComponent from 'components/event/EventFormBasicComponent.vue'
import { useRouter } from 'vue-router'
import { EventData } from 'src/types'

const router = useRouter()
const onEventCreated = (event: EventData) => {
  router.push({ name: 'DashboardEventPage', params: { id: event.id } })
}

</script>
