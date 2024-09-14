<script setup lang="ts">

</script>

<template>
  <q-header elevated>
    <q-toolbar>
      <q-toolbar-title>
        OpenMeet
      </q-toolbar-title>

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
        <q-route-tab :to="{name: 'AuthLoginPage'}">
          Login
        </q-route-tab>
        <q-route-tab :to="{name: 'AuthRegisterPage'}">
          Register
        </q-route-tab>
        <q-route-tab :to="{name: 'AuthForgotPasswordPage'}">
          Forgot
        </q-route-tab>
        <q-route-tab :to="{name: 'AuthRestorePasswordPage'}">
          Restore
        </q-route-tab>
      </q-tabs>
    </q-toolbar>
  </q-header>
</template>

<style scoped lang="scss">

</style>
