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
  <div class="c-header-nav-component row q-gutter-sm no-wrap">
    <q-btn color="primary" icon="sym_r_add_circle" padding="sm" outline no-wrap dense no-caps
      @click="openCreateGroupForm" label="New Group" />
    <q-btn color="primary" icon="sym_r_add_circle" padding="xs" outline no-wrap dense no-caps
      @click="openCreateEventForm" label="New Event" />
  </div>
</template>

<style scoped lang="scss"></style>
