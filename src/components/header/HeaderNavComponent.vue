<script setup type="ts">
import { useCreateGroupDialog } from 'src/composables/useCreateGroupDialog.ts'
import { useCreateEventDialog } from 'src/composables/useCreateEventDialog.ts'
import { useAuthStore } from 'stores/auth-store.ts'
import { useAuthDialog } from 'src/composables/useAuthDialog.ts'

const { openCreateGroupDialog } = useCreateGroupDialog()
const { openCreateEventDialog } = useCreateEventDialog()
const { openLoginDialog } = useAuthDialog()

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
  <q-tabs class="q-mr-md">
    <q-route-tab :to="{name: 'EventsPage'}">Events</q-route-tab>
    <q-route-tab class="a-mr-sm" :to="{name: 'GroupsPage'}">Groups</q-route-tab>
    <q-btn class="q-mx-sm" @click="openCreateGroupForm" icon="add" label="Add group"/>
    <q-btn @click="openCreateEventForm" icon="add" label="Add event"/>
  </q-tabs>
</template>

<style scoped lang="scss">

</style>
