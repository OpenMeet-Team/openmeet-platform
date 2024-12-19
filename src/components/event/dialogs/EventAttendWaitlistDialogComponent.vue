<template>
  <q-dialog data-cy="event-attend-waitlist-dialog">
    <q-card>
      <q-card-section>
        <div class="text-h6">Waitlist</div>
      </q-card-section>

      <q-card-section>
        <div class="text-body1">
          You are on the waitlist for this event. You will be notified when a spot opens up.
        </div>
      </q-card-section>

      <q-card-actions>
        <q-btn label="Close" v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>
