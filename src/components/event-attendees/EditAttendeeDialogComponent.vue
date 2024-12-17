<template>
  <q-dialog class="q-edit-attendee-dialog-component">
    <q-card>
      <q-card-section>
        <!-- Edit attendee role -->
        <q-select v-model="attendee.role" :options="attendeeRoles" label="Role" />
        <!-- Edit attendee status -->
        <q-select v-model="attendee.status" :options="attendeeStatuses" label="Status" />
      </q-card-section>

      <q-card-actions>
        <q-btn label="Cancel" @click="close" />
        <q-btn label="Save" @click="save" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { EventAttendeeEntity, EventAttendeeRole, EventAttendeeStatus } from 'src/types'
import { computed, ref } from 'vue'

interface Props {
  attendee: EventAttendeeEntity
}
const props = defineProps<Props>()

const attendee = ref(props.attendee)

interface Emits {
  (e: 'update:attendee', attendee: EventAttendeeEntity): void
  (e: 'close'): void
}
const emit = defineEmits<Emits>()

const attendeeRoles = computed(() => {
  return Object.values(EventAttendeeRole)
})
const attendeeStatuses = computed(() => {
  return Object.values(EventAttendeeStatus)
})

const save = () => {
  emit('update:attendee', attendee.value)
  emit('close')
}

const close = () => {
  emit('close')
}

</script>
