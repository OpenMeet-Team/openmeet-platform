<template>
  <q-page class="q-pa-md">
    <h1 class="text-h4 q-mb-md">Upcoming Events</h1>
    <!-- Show loader if loading, else show content -->
    <SpinnerComponent v-if="!loaded"/>

    <!-- Event List -->
    <div class="row q-col-gutter-md" v-if="loaded && events?.length">
      <div v-for="event in events" :key="event.id" class="col-12 col-sm-6 col-md-4">
        <EventsItemComponent :event="event"/>
      </div>
    </div>

    <!-- No content if no events and not loading -->
    <NoContentComponent v-else-if="loaded && !events.length" label="No Events" icon="sym_r_event_busy"/>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { eventsApi } from 'src/api/events.ts'
import { EventEntity } from 'src/types'
import EventsItemComponent from 'components/event/EventsItemComponent.vue'
import SpinnerComponent from 'components/common/SpinnerComponent.vue'

const events = ref<EventEntity[]>([])
const loaded = ref(false) // Add loading state

onMounted(() => {
  // Fetch events with loading state
  eventsApi.getAll().then(res => {
    events.value = res.data.data
  }).finally(() => {
    loaded.value = true
  })
})
</script>

<style scoped>
/* Styles for loading spinner */
.q-my-md {
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
