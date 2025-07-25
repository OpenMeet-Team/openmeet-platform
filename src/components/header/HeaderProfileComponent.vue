<template>
  <q-avatar class="cursor-pointer" v-if="useAuthStore().isAuthenticated">
    <template v-if="avatarUrl">
      <img data-cy="header-profile-avatar" :src="avatarUrl" alt="avatar">
    </template>
    <template v-else>
      <q-icon data-cy="header-profile-avatar" size="md" name="sym_r_person" />
    </template>
    <q-menu>
      <MenuItemComponent label="My events" icon="sym_r_event_note" to="/dashboard/events"/>
      <MenuItemComponent label="My groups" icon="sym_r_group" to="/dashboard/groups"/>
      <MenuItemComponent label="My chats" icon="sym_r_chat" to="/dashboard/chats"/>
      <MenuItemComponent v-if="isAdmin" label="Admin" icon="sym_r_admin_panel_settings" to="/admin"/>
      <q-separator/>
      <MenuItemComponent label="Profile" icon="sym_r_person" :to="{ name: 'MemberPage', params: {slug: useAuthStore().getUser.slug }}"/>
      <MenuItemComponent label="Account settings" icon="sym_r_settings" to="/dashboard/profile"/>
      <MenuItemComponent label="Logout" icon="sym_r_logout" @click="useAuthStore().actionLogout().then(() => router.push('/'))"/>
    </q-menu>
  </q-avatar>
</template>
<script setup lang="ts">
import MenuItemComponent from '../common/MenuItemComponent.vue'
import { useAuthStore } from '../../stores/auth-store'
import { useRouter } from 'vue-router'
import { useAvatarUrl } from '../../composables/useAvatarUrl'
import { computed, onMounted } from 'vue'
import { authApi } from '../../api/auth'
import { UserRole } from '../../types'

const router = useRouter()
const store = useAuthStore()

const user = computed(() => {
  if (!store.getUser) return null
  return store.getUser
})

const isAdmin = computed(() => {
  return store.hasRole(UserRole.Admin)
})

onMounted(async () => {
  try {
    const response = await authApi.getMe()
    store.actionSetUser(response.data)
  } catch (err) {
    console.error('Failed to load user data:', err)
  }
})

const { avatarUrl } = useAvatarUrl(user)

defineOptions({
  name: 'HeaderProfileComponent'
})
</script>
