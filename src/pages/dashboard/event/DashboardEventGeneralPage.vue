<script setup lang="ts">
import EventFormComponent from 'components/event/EventFormBasicComponent.vue'
import { useRouter, useRoute } from 'vue-router'
import { EventEntity } from 'src/types'

const router = useRouter()
const route = useRoute()
const onEventUpdated = (event: EventEntity) => {
  router.push({ name: 'EventPage', params: { id: event.id } })
}
</script>

<template>
    <EventFormComponent @updated="onEventUpdated" :edit-event-id="route.params.id as string" style="max-width: 500px" @close="router.push({ name: 'DashboardEventsPage' })"/>
</template>

<style scoped lang="scss">

</style>
