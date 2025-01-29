<template>
  <q-avatar class="cursor-pointer" v-if="useAuthStore().isAuthenticated">
    <template v-if="user?.photo?.path">
      <img data-cy="header-profile-avatar" :src="getImageSrc(user.photo.path)" alt="avatar">
    </template>
    <template v-else>
      <q-icon size="md" name="sym_r_person" />
    </template>
    <q-menu>
      <MenuItemComponent label="My events" icon="sym_r_event_note" to="/dashboard/events"/>
      <MenuItemComponent label="My groups" icon="sym_r_group" to="/dashboard/groups"/>
      <MenuItemComponent label="My chats" icon="sym_r_chat" to="/messages"/>
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
import { getImageSrc } from '../../utils/imageUtils'
import { computed } from 'vue'

const router = useRouter()
const authStore = useAuthStore()
const user = computed(() => authStore.getUser)

defineOptions({
  name: 'HeaderProfileComponent'
})
</script>
