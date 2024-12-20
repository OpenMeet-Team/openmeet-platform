<template>
  <q-dialog data-cy="event-attend-pending-dialog">
    <q-card>
      <q-card-section>
        <div class="text-h6">Attendance Pending</div>
      </q-card-section>

      <q-card-section>
        <div class="text-body1">
          Your attendance is pending approval. Please wait for the event organizer to approve your attendance.
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn color="primary" label="Close" v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>
