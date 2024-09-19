<template>
  <q-avatar class="cursor-pointer" v-if="useAuthStore().isAuthenticated">
    <img v-if="useAuthStore().getUser && useAuthStore().getUser.photo && useAuthStore().getUser.photo.path" :src="useAuthStore().getUser.photo.path" alt="avatar">
    <q-icon size="md" name="person" />
    <q-menu>
      <MenuItemComponent label="My events" icon="event_note" to="/dashboard/events"/>
      <MenuItemComponent label="My groups" icon="group" to="/dashboard/groups"/>
      <MenuItemComponent label="My tickets" icon="local_activity" to="/dashboard/tickets"/>
      <MenuItemComponent label="Account settings" icon="settings" to="/dashboard/profile"/>
      <q-separator/>
      <MenuItemComponent label="Logout" icon="logout" @click="useAuthStore().actionLogout().then(() => router.push('/'))"/>
    </q-menu>
  </q-avatar>
</template>
<script setup lang="ts">
import MenuItemComponent from 'components/general/MenuItemComponent.vue'
import { useAuthStore } from 'stores/auth-store.ts'
import { useRouter } from 'vue-router'

const router = useRouter()

defineOptions({
  name: 'HeaderProfileComponent'
})
</script>
