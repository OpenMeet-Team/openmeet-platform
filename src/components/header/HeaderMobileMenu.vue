<script setup lang="ts">
import { ref } from 'vue'
import { useEventDialog } from '../../composables/useEventDialog'
import { useAuthStore } from '../../stores/auth-store'
import { useAuth } from '../../composables/useAuth'
import MenuItemComponent from '../../components/common/MenuItemComponent.vue'
import HeaderDarkModeComponent from '../../components/header/HeaderDarkModeComponent.vue'
import { useRouter } from 'vue-router'

const { goToCreateEvent } = useEventDialog()
const { goToLogin, goToRegister } = useAuth()

const router = useRouter()
const openCreateGroupForm = () => {
  if (useAuthStore().isAuthenticated) {
    router.push({
      name: 'DashboardGroupCreatePage',
      query: {
        redirect: router.currentRoute.value.fullPath
      }
    })
    rightDrawerOpen.value = false
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

const rightDrawerOpen = ref<boolean>(false)

const toggleRightDrawer = () => {
  rightDrawerOpen.value = !rightDrawerOpen.value
}

const login = () => {
  goToLogin()
  rightDrawerOpen.value = false
}

const onClickLogout = () => {
  useAuthStore().actionLogout().then(() => {
    rightDrawerOpen.value = false
    router.push('/')
  })
}

const signUp = () => {
  goToRegister()
  rightDrawerOpen.value = false
}
</script>

<template>
  <q-btn
    flat
    dense
    round
    icon="sym_r_menu"
    aria-label="Menu"
    @click="toggleRightDrawer"
    class="lt-md"
    data-cy="header-mobile-menu"
  />

  <q-drawer v-model="rightDrawerOpen" side="right" bordered data-cy="header-mobile-menu-drawer">
    <q-list>
      <MenuItemComponent label="Home" :to="{name: 'HomePage'}"/>
      <MenuItemComponent label="Events" :to="{name: 'EventsPage'}"/>
      <MenuItemComponent label="Groups" :to="{name: 'GroupsPage'}"/>
      <q-item>
        <q-item-section side>
          <HeaderDarkModeComponent/>
        </q-item-section>
        <q-item-section>
          Toggle dark/light theme
        </q-item-section>
      </q-item>

      <MenuItemComponent data-cy="add-group-button" label="Add group" @click="openCreateGroupForm"/>
      <MenuItemComponent data-cy="add-event-button" label="Add new event" @click="openCreateEventForm"/>

      <template v-if="useAuthStore().isAuthenticated">
        <q-item-label header>Account</q-item-label>

        <MenuItemComponent data-cy="my-events-button" label="My events" icon="sym_r_event_note" :to="{name: 'DashboardEventsPage'}"/>
        <MenuItemComponent data-cy="my-groups-button" label="My groups" icon="sym_r_group" :to="{name: 'DashboardGroupsPage'}"/>
        <MenuItemComponent data-cy="my-chats-button" label="My chats" icon="sym_r_chat" :to="{name: 'DashboardChatsPage'}"/>

        <MenuItemComponent data-cy="profile-button" label="Profile" icon="sym_r_person" :to="{name: 'MemberPage', params: {slug: useAuthStore().user?.slug}}"/>
        <MenuItemComponent data-cy="account-settings-button" label="Account settings" icon="sym_r_settings" :to="{name: 'DashboardProfilePage'}"/>
        <q-separator/>
        <MenuItemComponent data-cy="logout-button" label="Logout" icon="sym_r_logout" @click="onClickLogout"/>
      </template>
      <template v-else>
        <MenuItemComponent data-cy="sign-in-button" @click="login" icon="sym_r_login" label="Login"/>
        <MenuItemComponent data-cy="sign-up-button" @click="signUp" icon="sym_r_person_add" label="Sign Up"/>
      </template>
    </q-list>
  </q-drawer>
</template>

<style scoped lang="scss">

</style>
