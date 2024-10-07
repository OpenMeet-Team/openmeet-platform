<script setup lang="ts">

import MenuItemComponent from 'components/common/MenuItemComponent.vue'
import DashboardDrawerCalendarComponent from 'components/dashboard/DashboardDrawerCalendarComponent.vue'
import { useRoute } from 'vue-router'
import { Screen } from 'quasar'

const route = useRoute()
</script>

<template>
  <q-drawer
    show-if-above
    bordered
    :mini="Screen.sm"
    :breakpoint="600"
    :width="350"
  >
    <q-scroll-area class="fit">
      <q-list padding>
        <MenuItemComponent label="My events" icon="sym_r_event_note" :to="{name: 'DashboardEventsPage'}"/>
        <MenuItemComponent label="My groups" icon="sym_r_group" :to="{name: 'DashboardGroupsPage'}"/>
        <MenuItemComponent label="My tickets" icon="sym_r_local_activity" :to="{name: 'DashboardTicketsPage'}"/>
        <MenuItemComponent label="Messages" icon="sym_r_local_activity" :to="{name: 'DashboardMessagesPage'}"/>
        <MenuItemComponent label="Account settings" icon="sym_r_settings" :to="{name: 'DashboardProfilePage'}"/>
        <q-separator/>
      </q-list>
      <DashboardDrawerCalendarComponent v-if="route.name === 'DashboardEventsPage'"/>
    </q-scroll-area>
  </q-drawer>
</template>

<style scoped lang="scss">

</style>
