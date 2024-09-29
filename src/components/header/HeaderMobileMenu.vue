<script setup lang="ts">
import { ref } from 'vue'
import { useQuasar } from 'quasar'
import { useCreateGroupDialog } from 'src/composables/useCreateGroupDialog.ts'
import { useCreateEventDialog } from 'src/composables/useCreateEventDialog.ts'
import { useAuthStore } from 'stores/auth-store.ts'
import { useAuthDialog } from 'src/composables/useAuthDialog.ts'
import MenuItemComponent from 'components/general/MenuItemComponent.vue'
import HeaderDarkModeComponent from 'components/header/HeaderDarkModeComponent.vue'

const { openCreateGroupDialog } = useCreateGroupDialog()
const { openCreateEventDialog } = useCreateEventDialog()
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

const $q = useQuasar()

const rightDrawerOpen = ref<boolean>(false)

const toggleRightDrawer = () => {
  rightDrawerOpen.value = !rightDrawerOpen.value
}

const login = () => {
  // Implement login logic here
  console.log('Login clicked')
  $q.notify({
    color: 'info',
    message: 'Login functionality to be implemented',
    icon: 'info'
  })
}

const signUp = () => {
  // Implement sign up logic here
  console.log('Sign Up clicked')
  $q.notify({
    color: 'info',
    message: 'Sign Up functionality to be implemented',
    icon: 'info'
  })
}
</script>

<template>
  <q-btn
    flat
    dense
    round
    icon="menu"
    aria-label="Menu"
    @click="toggleRightDrawer"
    class="lt-md"
  />

  <q-drawer class="text-black" v-model="rightDrawerOpen" side="right" overlay bordered>
    <q-list>
      <MenuItemComponent label="Home" :to="{name: 'HomePage'}"/>
      <MenuItemComponent label="Events" :to="{name: 'EventsPage'}"/>
      <MenuItemComponent label="Groups" :to="{name: 'GroupsPage'}"/>
      <q-item>
        <q-item-section>
          <HeaderDarkModeComponent/>
        </q-item-section>
      </q-item>
      <q-item>
        <q-item-section>
          <q-btn @click="openCreateGroupForm" label="Add group"/>
        </q-item-section>
      </q-item>
      <q-item>
        <q-item-section>
          <q-btn @click="openCreateEventForm" label="Add event"/>
        </q-item-section>
      </q-item>

      <q-item-label header>Account</q-item-label>

      <template v-if="useAuthStore().isAuthenticated">
        <MenuItemComponent label="My events" icon="event_note" :to="{name: 'DashboardEventsPage'}"/>
        <MenuItemComponent label="My groups" icon="group" :to="{name: 'DashboardGroupsPage'}"/>
        <MenuItemComponent label="My tickets" icon="local_activity" :to="{name: 'DashboardTicketsPage'}"/>
        <MenuItemComponent label="Account settings" icon="settings" :to="{name: 'DashboardProfilePage'}"/>
      </template>
      <template v-else>
        <q-item clickable v-ripple @click="login">
          <q-item-section avatar>
            <q-icon name="login"/>
          </q-item-section>
          <q-item-section>Login</q-item-section>
        </q-item>
        <q-item clickable v-ripple @click="signUp">
          <q-item-section avatar>
            <q-icon name="person_add"/>
          </q-item-section>
          <q-item-section>Sign Up</q-item-section>
        </q-item>
      </template>
    </q-list>
  </q-drawer>
</template>

<style scoped lang="scss">

</style>
