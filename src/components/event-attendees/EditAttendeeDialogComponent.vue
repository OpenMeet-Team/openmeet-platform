<template>
  <q-dialog ref="dialogRef" data-cy="edit-attendee-dialog-component" class="q-edit-attendee-dialog-component">
    <SpinnerComponent v-if="isLoading" />
    <!-- Set attendee role and status -->
    <q-card style="min-width: 300px;">
      <q-card-section>
        <div class="row items-center q-gutter-md">
          <q-avatar class="cursor-pointer" size="lg" @click="openUserProfile(attendee.user.slug)">
            <img :src="getImageSrc(attendee.user.photo)">
          </q-avatar>
          <div class="text-h6 cursor-pointer" @click="openUserProfile(attendee.user.slug)">
            {{ attendee.user.name }}
          </div>
        </div>
      </q-card-section>

      <!-- Approval answer -->
      <q-card-section>
        <div class="text-body2 text-bold">Approval answer:</div>
        <div class="text-body2">{{ attendee.approvalAnswer }}</div>
      </q-card-section>

      <q-card-section>
        <!-- Edit attendee role -->
        <q-select v-model="role" :options="attendeeRoles" label="Attendee Role" emit-value map-options />
        <!-- Edit attendee status -->
        <q-select v-model="status" :options="attendeeStatuses" label="Attending Status" emit-value map-options />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn no-caps flat label="Cancel" @click="onDialogCancel" />
        <q-btn :loading="isLoading" no-caps color="primary" label="Save" @click="save" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { useDialogPluginComponent } from 'quasar'
import { eventsApi } from 'src/api'
import { EventAttendeeEntity, EventAttendeeRole, EventAttendeeStatus } from 'src/types'
import { getImageSrc } from 'src/utils/imageUtils'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import SpinnerComponent from '../common/SpinnerComponent.vue'
interface Props {
  attendee: EventAttendeeEntity
}
const props = defineProps<Props>()

const attendee = ref(props.attendee)

const role = ref(props.attendee.role.name)
const status = ref(props.attendee.status)
const route = useRoute()
const isLoading = ref(false)
const { dialogRef, onDialogOK, onDialogCancel } = useDialogPluginComponent()

const attendeeRoles = computed(() => {
  return Object.values(EventAttendeeRole).filter(role => role !== EventAttendeeRole.Guest).map(role => ({ label: role.charAt(0).toUpperCase() + role.slice(1), value: role }))
})
const attendeeStatuses = computed(() => {
  return Object.values(EventAttendeeStatus).filter(t => [EventAttendeeStatus.Waitlist, EventAttendeeStatus.Confirmed, EventAttendeeStatus.Pending, EventAttendeeStatus.Cancelled, EventAttendeeStatus.Rejected].includes(t)).map(t => ({ label: t.charAt(0).toUpperCase() + t.slice(1), value: t }))
})

const save = () => {
  isLoading.value = true
  eventsApi.updateAttendee(route.params.slug as string, attendee.value.id, {
    role: role.value,
    status: status.value
  }).then(res => {
    onDialogOK(res.data)
  }).finally(() => {
    isLoading.value = false
  })
}

const openUserProfile = (slug: string) => {
  window.open(`/members/${slug}`, '_blank')
}

</script>
