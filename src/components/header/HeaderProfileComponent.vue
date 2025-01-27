<template>
  <div class="bg-purple-200">
    {{ Object.keys(user.photo)  }}
    <img :src="getImageSrc(user.photo)" alt="avatar1">
    <img :src="getImageSrc(user.photo.path)" alt="avatar2">
  </div>
  <q-avatar class="cursor-pointer" v-if="useAuthStore().isAuthenticated">
    <img data-cy="header-profile-avatar" :src="getImageSrc(user.photo.path)" alt="avatar">
    <q-icon size="md" name="sym_r_person" />
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

const router = useRouter()
const user = useAuthStore().getUser
console.log('HeaderProfileComponent user', user)
console.log('HeaderProfileComponent photo', user.photo)
console.log('HeaderProfileComponent getImageSrc', getImageSrc(user.photo))

defineOptions({
  name: 'HeaderProfileComponent'
})
</script>
