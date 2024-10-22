<template>
  <q-page padding>
    <DashboardTitle :backTo="{ name: 'DashboardEventsPage' }" label="Edit Event"/>

    <div class="row justify-center">
        <EventFormBasicComponent class="col" @updated="navigateToEvent($event.slug, $event.id)" :edit-event-id="route.params.id as string" style="max-width: 500px" @close="router.push({ name: 'DashboardEventsPage' })"/>
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
