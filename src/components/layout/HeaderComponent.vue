<script setup lang="ts">

import MenuItemComponent from 'components/general/MenuItemComponent.vue'
// import SearchComponent from 'components/general/SearchComponent.vue'
</script>

<template>
  <q-header elevated>
    <q-toolbar>
      <q-toolbar-title shrink>
        <router-link style="color: inherit; text-decoration: none" to="/">OpenMeet</router-link>
      </q-toolbar-title>

<!--      <SearchComponent/>-->
      <q-space/>

      <q-tabs>
        <q-route-tab :to="{name: 'HomePage'}">
          Home
        </q-route-tab>
        <q-route-tab :to="{name: 'EventsPage'}">
          Events
        </q-route-tab>
        <q-route-tab :to="{name: 'EventPage', params: {eventId: 'event-id'}}">
          Event
        </q-route-tab>
        <q-tab>
          <div class="row items-center">Auth
            <q-icon right name="arrow_downward"/>
          </div>
          <q-menu>
            <MenuItemComponent label="Login" :to="{name: 'AuthLoginPage'}"/>
            <MenuItemComponent label="Register" :to="{name: 'AuthRegisterPage'}"/>
            <MenuItemComponent label="Forgot password" :to="{name: 'AuthForgotPasswordPage'}"/>
            <MenuItemComponent label="Restore password" :to="{name: 'AuthRestorePasswordPage'}"/>
          </q-menu>
        </q-tab>
        <q-tab>
          <div class="row items-center">Dashboard
            <q-icon right name="arrow_downward"/>
          </div>
          <q-menu>
            <MenuItemComponent label="Events" :to="{name: 'DashboardEventsPage'}"/>
            <MenuItemComponent label="Groups" :to="{name: 'DashboardGroupsPage'}"/>
            <MenuItemComponent label="Tickets" :to="{name: 'DashboardTicketsPage'}"/>
            <MenuItemComponent label="Profile" :to="{name: 'DashboardProfilePage'}"/>
          </q-menu>
        </q-tab>

      </q-tabs>

    </q-toolbar>
  </q-header>
</template>

<style scoped lang="scss">

</style>
