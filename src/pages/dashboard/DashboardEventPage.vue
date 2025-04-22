<template>
  <q-page data-cy="dashboard-event-page" padding class="c-dashboard-event-page q-pb-xl">
    <div class="q-mx-auto" style="max-width: 1024px">
      <DashboardTitle :backTo="{ name: 'DashboardEventsPage' }" label="Edit Event" />

      <div class="row justify-center">
        <EventFormBasicComponent class="q-mt-md col" style="max-width: 500px"
          @updated="navigateToEvent($event)"
          @created="navigateToEvent($event)"
          :edit-event-slug="route.params.slug as string"
          @close="router.push({ name: 'DashboardEventsPage' })" />
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { useNavigation } from '../../composables/useNavigation'
import EventFormBasicComponent from '../../components/event/EventFormBasicComponent.vue'
import DashboardTitle from '../../components/dashboard/DashboardTitle.vue'

const { navigateToEvent } = useNavigation()
const router = useRouter()

const route = useRoute()

</script>
