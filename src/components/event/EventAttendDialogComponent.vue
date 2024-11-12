<script setup lang="ts">
import { ref } from 'vue'
import { EventEntity } from 'src/types'
import { QDialog, useDialogPluginComponent } from 'quasar'
import { useNavigation } from 'src/composables/useNavigation'
// import { addToGoogleCalendar, addToOutlookCalendar } from 'src/utils/dateUtils.ts'

interface Props {
  event: EventEntity
}

const approvalAnswer = ref<string>('')

defineProps<Props>()

const { navigateToGroup } = useNavigation()

defineEmits([
  ...useDialogPluginComponent.emits
])

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()
</script>

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" persistent class="c-event-attend-dialog-component">

    <q-card v-if="event.approvalQuestion">
      <q-card-section>
        <div class="text-h6">Please answer the following question to attend this event:</div>
      </q-card-section>
      <q-card-section>
        {{ event.approvalQuestion }}
        <q-input v-model="approvalAnswer" required filled type="textarea" />
      </q-card-section>
      <q-card-actions align="right">
        <q-btn no-caps flat label="Cancel" color="primary" @click="onDialogCancel"/>
        <q-btn no-caps label="Confirm" color="primary" @click="onDialogOK({ approvalAnswer })"/>
      </q-card-actions>
    </q-card>

    <q-card v-else-if="event.requireGroupMembership && event.group">
      <q-card-section>
        <div class="text-h6">You must be a member of the following group to attend this event:</div>
      </q-card-section>
      <q-card-section>
        {{ event.group?.name }}
      </q-card-section>
      <q-card-actions align="right">
        <q-btn no-caps flat label="Cancel" color="primary" @click="onDialogCancel"/>
        <q-btn no-caps label="Join Group" color="primary" @click="navigateToGroup(event.group?.slug, event.group?.id)" />
      </q-card-actions>
    </q-card>

    <q-card v-else>
      <q-card-section>
        <div class="text-h6">Confirm Attendance</div>
      </q-card-section>

      <!-- allowWaitlist -->
      <q-card-section>
        Are you sure you want to attend this event?
      </q-card-section>

      <q-card-actions align="right">
        <q-btn no-caps flat label="Cancel" color="primary" @click="onDialogCancel"/>
        <q-btn no-caps label="Confirm" color="primary" @click="onDialogOK"/>
      </q-card-actions>
    </q-card>
<!--    <q-card>-->
<!--      <q-card-section>-->
<!--        <div class="text-h6">Add Event to Calendar</div>-->
<!--      </q-card-section>-->

<!--      <q-card-section>-->
<!--        <q-btn label="Add to Google Calendar" color="primary" icon="event" @click="addToGoogleCalendar(event)" />-->
<!--        <q-btn label="Add to Outlook" color="primary" icon="event" @click="addToOutlookCalendar(event)" />-->
<!--      </q-card-section>-->

<!--      <q-card-actions align="right">-->
<!--        <q-btn color="primary" label="OK" @click="onOKClick" />-->
<!--        <q-btn color="primary" label="Cancel" @click="onDialogCancel" />-->
<!--      </q-card-actions>-->
<!--    </q-card>-->
  </q-dialog>

</template>

<style scoped lang="scss">

</style>
