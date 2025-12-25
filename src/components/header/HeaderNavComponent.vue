<script setup type="ts">
import { useEventDialog } from 'src/composables/useEventDialog.ts'
import { useAuthStore } from '../../stores/auth-store.ts'
import { useAuth } from 'src/composables/useAuth.ts'
import { useRouter } from 'vue-router'

const router = useRouter()
const { goToCreateEvent } = useEventDialog()
const { goToLogin } = useAuth()

const openCreateGroupForm = () => {
  if (useAuthStore().isAuthenticated) {
    router.push({
      name: 'DashboardGroupCreatePage',
      query: {
        redirect: router.currentRoute.value.fullPath
      }
    })
  } else {
    goToLogin()
  }
}

const openCreateEventForm = () => {
  if (useAuthStore().isAuthenticated) {
    goToCreateEvent()
  } else {
    goToLogin()
  }
}
</script>

<template>
  <div class="c-header-nav-component row q-gutter-sm no-wrap">
    <q-btn data-cy="header-nav-add-group-button" aria-label="Create new group" color="primary" icon="sym_r_add_circle" padding="sm" outline no-wrap dense no-caps
      @click="openCreateGroupForm" label="New Group" />
    <q-btn data-cy="header-nav-add-event-button" aria-label="Create new event" color="primary" icon="sym_r_add_circle" padding="sm" outline no-wrap dense no-caps
      @click="openCreateEventForm" label="New Event" />
  </div>
</template>

<style scoped lang="scss"></style>
