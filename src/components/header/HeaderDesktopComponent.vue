<script setup lang="ts">
import HeaderDesktopMenu from './HeaderDesktopMenu.vue'
import HeaderLogoComponent from './HeaderLogoComponent.vue'
import HeaderSearchComponent from './HeaderSearchComponent.vue'
</script>

<template>
  <div class="c-header-desktop-component">
    <div class="xs-hide bg-dark-page text-white text-uppercase text-body2 text-bold row justify-center q-pa-sm" >
      This platform is currently in beta. Data may be lost during updates.
    </div>
    <div class="row q-gutter-md justify-end q-pa-sm">
      <router-link class="router-link-inherit text-bold" no-caps :to="{name: 'EventsPage'}">Events</router-link>
      <router-link class="router-link-inherit text-bold" no-caps :to="{name: 'GroupsPage'}">Groups</router-link>
      <router-link class="router-link-inherit text-bold" no-caps to="" href="https://biz.openmeet.net/about" target="_blank">About Us</router-link>
    </div>

    <q-toolbar>
      <HeaderLogoComponent/>

      <HeaderSearchComponent/>
<!--      <HeaderLocationComponent/>-->
      <q-space/>

      <HeaderDesktopMenu/>
    </q-toolbar>
  </div>
</template>
