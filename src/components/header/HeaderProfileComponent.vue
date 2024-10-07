<template>
  <q-avatar class="cursor-pointer" v-if="useAuthStore().isAuthenticated">
    <img v-if="useAuthStore().getUser && useAuthStore().getUser.photo && useAuthStore().getUser.photo.path" :src="useAuthStore().getUser.photo.path" alt="avatar">
    <q-icon size="md" name="sym_r_person" />
    <q-menu>
      <MenuItemComponent label="My events" icon="sym_r_event_note" to="/dashboard/events"/>
      <MenuItemComponent label="My groups" icon="sym_r_group" to="/dashboard/groups"/>
      <MenuItemComponent label="My tickets" icon="sym_r_local_activity" to="/dashboard/tickets"/>
      <MenuItemComponent label="Account settings" icon="sym_r_settings" to="/dashboard/profile"/>
      <q-separator/>
      <MenuItemComponent label="Logout" icon="sym_r_logout" @click="useAuthStore().actionLogout().then(() => router.push('/'))"/>
    </q-menu>
  </q-avatar>
</template>
<script setup lang="ts">
import MenuItemComponent from 'components/common/MenuItemComponent.vue'
import { useAuthStore } from 'stores/auth-store.ts'
import { useRouter } from 'vue-router'

const router = useRouter()

defineOptions({
  name: 'HeaderProfileComponent'
})
</script>
