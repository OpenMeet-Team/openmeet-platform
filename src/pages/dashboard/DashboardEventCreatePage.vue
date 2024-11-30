<template>
  <q-page padding class="q-mx-auto q-px-xl" style="max-width: 500px;">
    <DashboardTitle :backTo="{ name: 'DashboardEventsPage' }" label="Create New Event" />

    <EventFormComponent class="col" @created="navigateToEvent($event)" @close="onClose" />
  </q-page>
</template>

<script setup lang="ts">
import EventFormComponent from 'components/event/EventFormBasicComponent.vue'
import { useRouter } from 'vue-router'
import DashboardTitle from 'components/dashboard/DashboardTitle.vue'
import { useNavigation } from 'src/composables/useNavigation'

const router = useRouter()
const { navigateToEvent } = useNavigation()

const onClose = () => {
  router.push({ name: 'DashboardEventsPage' })
}

</script>
