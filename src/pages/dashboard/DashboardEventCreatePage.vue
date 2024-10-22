<template>
  <q-page padding>
    <DashboardTitle :backTo="{ name: 'DashboardEventsPage' }" label="Create New Event"/>

    <div class="row justify-center">
        <EventFormComponent class="col" @created="navigateToEvent($event.slug, $event.id)" style="max-width: 500px" @close="onClose"/>
    </div>
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
