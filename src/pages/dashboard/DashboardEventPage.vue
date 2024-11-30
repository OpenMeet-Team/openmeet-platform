<template>
  <q-page padding class="c-dashboard-event-page">
    <div class="q-mx-auto q-pb-xl" style="max-width: 500px">
      <DashboardTitle :backTo="{ name: 'DashboardEventsPage' }" label="Edit Event" />

      <EventFormBasicComponent @updated="navigateToEvent($event)" :edit-event-slug="route.params.slug as string"
        @close="router.push({ name: 'DashboardEventsPage' })" />
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { useNavigation } from 'src/composables/useNavigation'
import EventFormBasicComponent from 'src/components/event/EventFormBasicComponent.vue'
import DashboardTitle from 'src/components/dashboard/DashboardTitle.vue'

const { navigateToEvent } = useNavigation()
const router = useRouter()

const route = useRoute()

</script>
