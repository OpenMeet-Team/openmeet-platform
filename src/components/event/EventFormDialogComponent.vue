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

const onClose = () => {
  if (dialogRef.value) dialogRef.value.hide()
}
</script>

<template>
  <q-dialog ref="dialogRef" persistent>
    <q-card class="full-width q-pa-md" style="max-width: 500px">
      <div class="row q-mb-xl">
        <h1 class="text-h4 q-my-none">Create an event</h1>
      </div>

      <EventFormComponent @created="onEventCreated" @close="onClose"/>
    </q-card>
  </q-dialog>
</template>

<style scoped lang="scss">

</style>
