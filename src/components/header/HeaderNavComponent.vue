<script setup type="ts">
import { useGroupDialog } from 'src/composables/useGroupDialog.ts'
import { useEventDialog } from 'src/composables/useEventDialog.ts'
import { useAuthStore } from 'stores/auth-store.ts'
import { useAuthDialog } from 'src/composables/useAuthDialog.ts'

const { openCreateGroupDialog } = useGroupDialog()
const { openCreateEventDialog } = useEventDialog()
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
    <q-route-tab no-caps :to="{name: 'EventsPage'}">Events</q-route-tab>
    <q-route-tab no-caps :to="{name: 'GroupsPage'}">Groups</q-route-tab>
    <q-route-tab no-caps href="https://biz.openmeet.net/about" target="_blank">About Us</q-route-tab>
    <q-btn size="md" color="primary" no-wrap dense no-caps class="q-mx-sm" @click="openCreateGroupForm" icon="sym_r_add" label="Add group"/>
    <q-btn size="md" color="primary" no-wrap dense no-caps @click="openCreateEventForm" icon="sym_r_add" label="Add event"/>
  </q-tabs>
</template>

<style scoped lang="scss">

</style>
