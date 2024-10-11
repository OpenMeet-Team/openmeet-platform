<template>
  <q-page padding>
    <DashboardTitle :backTo="{ name: 'DashboardEventsPage' }" label="Create New Event"/>

    <EventFormComponent @created="onEventCreated" style="max-width: 500px" @close="onClose"/>
  </q-page>
</template>

<script setup lang="ts">
import EventFormComponent from 'components/event/EventFormBasicComponent.vue'
import { useRouter } from 'vue-router'
import { EventEntity } from 'src/types'
import DashboardTitle from 'components/dashboard/DashboardTitle.vue'

const router = useRouter()
const onEventCreated = (event: EventEntity) => {
  router.push({ name: 'DashboardEventPage', params: { id: event.id } })
}

const onClose = () => {
  router.push({ name: 'DashboardEventsPage' })
}

</script>
