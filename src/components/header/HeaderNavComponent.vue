<script setup type="ts">
import { useCreateGroupDialog } from 'src/composables/useCreateGroupDialog.ts'
import { useCreateEventDialog } from 'src/composables/useCreateEventDialog.ts'
import { useAuthStore } from 'stores/auth-store.ts'
import { useLoginDialog } from 'src/composables/useLoginDialog.ts'

const { openCreateGroupDialog } = useCreateGroupDialog()
const { openCreateEventDialog } = useCreateEventDialog()
const { openLoginDialog } = useLoginDialog()

const openCreateGroupForm = () => {
  if (useAuthStore().isAuthenticated) {
    openCreateGroupDialog()
  } else {
    openLoginDialog()
  }
}

const openCreateEventForm = () => {
  if (useAuthStore().isAuthenticated) {
    openCreateEventDialog()
  } else {
    openLoginDialog()
  }
}
</script>

<template>
  <q-tabs>
    <q-route-tab :to="{name: 'HomePage'}">
      Home
    </q-route-tab>
    <q-route-tab :to="{name: 'EventsPage'}">
      Events
    </q-route-tab>
    <q-route-tab :to="{name: 'GroupsPage'}">
      Groups
    </q-route-tab>

    <div class="row q-gutter-md">
      <q-btn @click="openCreateGroupForm" label="Add group" />
      <q-btn @click="openCreateEventForm" label="Add event" />
    </div>
  </q-tabs>
</template>

<style scoped lang="scss">

</style>
