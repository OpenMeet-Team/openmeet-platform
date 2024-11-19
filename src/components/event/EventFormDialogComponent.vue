<script setup lang="ts">

import EventFormComponent from 'components/event/EventFormBasicComponent.vue'
import { ref } from 'vue'
import { QDialog } from 'quasar'
import { EventEntity, GroupEntity } from 'src/types'
import { useNavigation } from 'src/composables/useNavigation'

interface Props {
  group?: GroupEntity
}

defineProps<Props>()

const dialogRef = ref<QDialog | null>(null)
const { navigateToEvent } = useNavigation()

const onEventCreated = (event: EventEntity) => {
  if (dialogRef.value) {
    dialogRef.value.hide()
    navigateToEvent(event)
  }
}

const onClose = () => {
  if (dialogRef.value) dialogRef.value.hide()
}
</script>

<template>
  <q-dialog ref="dialogRef" persistent class="c-event-form-dialog-component" data-cy="event-form-dialog">
    <q-card class="full-width q-pa-md" style="max-width: 500px">
      <div class="row q-mb-xl">
        <h1 class="text-h4 q-my-none">Create an event</h1>
      </div>

      <EventFormComponent :group="group" @created="onEventCreated" @close="onClose"/>
    </q-card>
  </q-dialog>
</template>

<style scoped lang="scss">

</style>
