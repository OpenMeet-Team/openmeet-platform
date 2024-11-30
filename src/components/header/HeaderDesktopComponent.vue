<script setup lang="ts">
import { Dark } from 'quasar'
import HeaderDesktopMenu from './HeaderDesktopMenu.vue'
import HeaderLogoComponent from './HeaderLogoComponent.vue'
import HeaderSearchComponent from './HeaderSearchComponent.vue'
</script>

<template>
  <div class="c-header-desktop-component">
    <div class="xs-hide bg-dark-page text-white text-uppercase text-body2 text-bold row justify-center q-pa-sm" >
      This platform is currently in beta. Data may be lost during updates.
    </div>
    <div class="row justify-end q-py-sm q-px-md" :class="Dark.isActive ? 'bg-dark-page text-white' : 'bg-primary-light-gray'">
      <router-link class="router-link-inherit text-bold q-mr-md" no-caps :to="{name: 'EventsPage'}">Events</router-link>
      <router-link class="router-link-inherit text-bold q-mr-md" no-caps :to="{name: 'GroupsPage'}">Groups</router-link>
      <router-link class="router-link-inherit text-bold" no-caps to="" href="https://biz.openmeet.net/about" target="_blank">About Us</router-link>
    </div>

    <q-toolbar class="q-py-md">
      <HeaderLogoComponent/>

      <HeaderSearchComponent/>
<!--      <HeaderLocationComponent/>-->
      <q-space/>

      <HeaderDesktopMenu/>
    </q-toolbar>
  </div>
</template>
