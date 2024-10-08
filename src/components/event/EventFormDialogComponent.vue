<script setup lang="ts">

import EventFormComponent from 'components/event/EventFormBasicComponent.vue'
import { ref } from 'vue'
import { QDialog } from 'quasar'
import { useRouter } from 'vue-router'
import { EventEntity } from 'src/types'

const dialogRef = ref<QDialog | null>(null)
const router = useRouter()

const onEventCreated = (event: EventEntity) => {
  if (dialogRef.value) {
    dialogRef.value.hide()
    router.push({ name: 'DashboardEventPage', params: { id: event.id } })
  }
}
</script>

<template>
  <q-dialog ref="dialogRef" persistent>
    <q-card class="full-width q-pa-md" style="max-width: 500px">
      <div class="row q-mb-xl">
        <h1 class="text-h4 q-my-none">Create New Event</h1>
      </div>

      <EventFormComponent @created="onEventCreated">
        <div class="row justify-end q-gutter-md">
          <q-btn flat label="Cancel" v-close-popup/>
          <q-btn label="Create Event" type="submit" color="primary"/>
        </div>
      </EventFormComponent>
    </q-card>
  </q-dialog>
</template>

<style scoped lang="scss">

</style>
