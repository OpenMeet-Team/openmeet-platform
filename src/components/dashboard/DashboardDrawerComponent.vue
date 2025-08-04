<script setup lang="ts">

import MenuItemComponent from 'components/common/MenuItemComponent.vue'
import { Screen } from 'quasar'

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
        <MenuItemComponent label="My chats" icon="sym_r_chat" :to="{name: 'DashboardChatsPage'}"/>
        <MenuItemComponent label="Account settings" icon="sym_r_settings" :to="{name: 'DashboardProfilePage'}"/>
        <q-separator/>
      </q-list>
    </q-scroll-area>
  </q-drawer>
</template>

<style scoped lang="scss">

</style>
