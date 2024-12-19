<template>
  <q-dialog data-cy="event-attendees-no-rights-dialog">
    <q-card>
      <q-card-section>
        <div class="text-h6">No rights to view attendees</div>
      </q-card-section>

      <q-card-section>
        <div class="text-body1">
          You do not have permission to view the attendees of this event. Attend the event and wait for approval if needed.
        </div>
      </q-card-section>

      <q-card-actions>
        <q-btn label="Close" v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>
