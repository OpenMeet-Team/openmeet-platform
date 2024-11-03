<script setup lang="ts">
import { ref } from 'vue'
import { useGroupDialog } from 'src/composables/useGroupDialog.ts'
import { useEventDialog } from 'src/composables/useEventDialog.ts'
import { useAuthStore } from 'stores/auth-store.ts'
import { useAuthDialog } from 'src/composables/useAuthDialog.ts'
import MenuItemComponent from 'components/common/MenuItemComponent.vue'
import HeaderDarkModeComponent from 'components/header/HeaderDarkModeComponent.vue'
import { useRouter } from 'vue-router'

const { openCreateGroupDialog } = useGroupDialog()
const { openCreateEventDialog } = useEventDialog()
const { openLoginDialog, openRegisterDialog } = useAuthDialog()

const router = useRouter()
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

const rightDrawerOpen = ref<boolean>(false)

const toggleRightDrawer = () => {
  rightDrawerOpen.value = !rightDrawerOpen.value
}

const login = () => {
  openLoginDialog()
  rightDrawerOpen.value = false
}

const onClickLogout = () => {
  useAuthStore().actionLogout().then(() => {
    rightDrawerOpen.value = false
    router.push('/')
  })
}

const signUp = () => {
  openRegisterDialog()
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

      <MenuItemComponent label="Add group" @click="openCreateGroupForm"/>
      <MenuItemComponent label="Add new event" @click="openCreateEventForm"/>

      <template v-if="useAuthStore().isAuthenticated">
        <q-item-label header>Account</q-item-label>

        <MenuItemComponent label="My events" icon="sym_r_event_note" :to="{name: 'DashboardEventsPage'}"/>
        <MenuItemComponent label="My groups" icon="sym_r_group" :to="{name: 'DashboardGroupsPage'}"/>
        <MenuItemComponent label="Profile" icon="sym_r_person" :to="{name: 'MemberPage', params: {id: useAuthStore().user?.id}}"/>
        <MenuItemComponent label="Account settings" icon="sym_r_settings" :to="{name: 'DashboardProfilePage'}"/>
        <q-separator/>
        <MenuItemComponent label="Logout" icon="sym_r_logout" @click="onClickLogout"/>
      </template>
      <template v-else>
        <MenuItemComponent @click="login" icon="sym_r_login" label="Login" data-cy="sign-in-button"/>
        <MenuItemComponent @click="signUp" icon="sym_r_person_add" label="Sign Up" data-cy="sign-up-button"/>
      </template>
    </q-list>
  </q-drawer>
</template>

<style scoped lang="scss">

</style>
