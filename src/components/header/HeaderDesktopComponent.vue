<script setup lang="ts">
import { Dark } from 'quasar'
import HeaderDesktopMenu from './HeaderDesktopMenu.vue'
import HeaderLogoComponent from './HeaderLogoComponent.vue'
import HeaderSearchComponent from './HeaderSearchComponent.vue'
</script>

<template>
  <div class="c-header-desktop-component">
    <div class="xs-hide bg-purple-500 text-white text-uppercase text-body2 text-bold row justify-center q-pa-sm" >
      This platform is currently in beta. Report issues&nbsp;<a class="text-primary" href="https://github.com/openmeet-team/openmeet-platform/issues" target="_blank">here</a>.
    </div>
    <div class="row justify-end q-py-sm q-px-md" :class="Dark.isActive ? 'bg-dark-page text-white' : 'bg-purple-100'">
      <router-link class="router-link-inherit text-bold q-mr-md no-underline" no-caps :to="{name: 'EventsPage'}">Events</router-link>
      <router-link class="router-link-inherit text-bold q-mr-md no-underline" no-caps :to="{name: 'GroupsPage'}">Groups</router-link>
      <router-link class="router-link-inherit text-bold no-underline" no-caps to="" href="https://biz.openmeet.net/about" target="_blank">About Us</router-link>
    </div>

    <div class="q-py-md row justify-between items-center q-px-md no-wrap">
      <HeaderLogoComponent/>

      <HeaderSearchComponent/>
<!--      <HeaderLocationComponent/>-->
      <q-space/>

      <HeaderDesktopMenu/>
    </div>
  </div>
</template>

<style scoped lang="scss">
.no-underline {
  color: $purple-400;
  text-decoration: none;
}
</style>
