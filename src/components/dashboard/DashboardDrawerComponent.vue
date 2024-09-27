<script setup lang="ts">

import MenuItemComponent from 'components/general/MenuItemComponent.vue'
import DashboardDrawerCalendarComponent from 'components/dashboard/DashboardDrawerCalendarComponent.vue'
</script>

<template>
  <q-drawer
    show-if-above
    bordered
    :width="300"
  >
    <q-scroll-area class="fit">
      <q-list padding>
        <MenuItemComponent label="My events" icon="event_note" :to="{name: 'DashboardEventsPage'}"/>
        <MenuItemComponent label="My groups" icon="group" :to="{name: 'DashboardGroupsPage'}"/>
        <MenuItemComponent label="My tickets" icon="local_activity" :to="{name: 'DashboardTicketsPage'}"/>
        <MenuItemComponent label="Messages" icon="local_activity" :to="{name: 'DashboardMessagesPage'}"/>
        <MenuItemComponent label="Account settings" icon="settings" :to="{name: 'DashboardProfilePage'}"/>
        <q-separator/>
      </q-list>
      <DashboardDrawerCalendarComponent/>
    </q-scroll-area>
  </q-drawer>
</template>

<style scoped lang="scss">

</style>
