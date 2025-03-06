<script setup lang="ts">
import HeaderLogoComponent from './HeaderLogoComponent.vue'
import HeaderMobileMenu from './HeaderMobileMenu.vue'
import HeaderSearchComponent from './HeaderSearchComponent.vue'
</script>

<template>
  <div class="c-header-mobile-component">
    <div class="xs-hide bg-dark-page text-white text-uppercase text-body2 text-bold row justify-center q-pa-sm" >
      This platform is currently in beta. Report issues <a class="text-primary" href="https://github.com/openmeet-team/openmeet-platform/issues" target="_blank">here</a>.
    </div>

    <q-toolbar>
      <HeaderLogoComponent/>

      <HeaderSearchComponent/>
<!--      <HeaderLocationComponent/>-->

      <q-space/>

      <HeaderMobileMenu/>
    </q-toolbar>
  </div>
</template>
