<script setup lang="ts">
import HeaderLogoComponent from './HeaderLogoComponent.vue'
import HeaderMobileMenu from './HeaderMobileMenu.vue'
import HeaderSearchComponent from './HeaderSearchComponent.vue'
</script>

<template>
  <div class="c-header-mobile-component">
    <q-toolbar>
      <HeaderLogoComponent/>

      <HeaderSearchComponent/>
<!--      <HeaderLocationComponent/>-->

      <q-space/>

      <HeaderMobileMenu/>
    </q-toolbar>
  </div>
</template>
