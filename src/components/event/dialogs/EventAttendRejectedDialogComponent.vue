<template>
  <q-dialog data-cy="event-attend-rejected-dialog">
    <q-card>
      <q-card-section>
        <div class="text-h6">Rejected</div>
      </q-card-section>

      <q-card-section>
        <div class="text-body1">
          You have been rejected from this event.
        </div>
      </q-card-section>
    </q-card>

    <q-card-actions>
      <q-btn label="Close" v-close-popup />
    </q-card-actions>
  </q-dialog>
</template>
