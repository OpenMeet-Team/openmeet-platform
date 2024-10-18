<script setup lang="ts">

import { EventEntity } from 'src/types'
import { QDialog, useDialogPluginComponent } from 'quasar'
// import { addToGoogleCalendar, addToOutlookCalendar } from 'src/utils/dateUtils.ts'

interface Props {
  event: EventEntity
}

defineProps<Props>()

defineEmits([
  ...useDialogPluginComponent.emits
])

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()
</script>

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" persistent>

    <q-card>
      <q-card-section>
        <div class="text-h6">Confirm Attendance</div>
      </q-card-section>

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
