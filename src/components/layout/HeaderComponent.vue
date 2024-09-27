<script setup lang="ts">
import SearchComponent from 'components/general/SearchComponent.vue'
import HeaderLogoComponent from 'components/header/HeaderLogoComponent.vue'
import HeaderMobileMenu from 'components/header/HeaderMobileMenu.vue'
import HeaderDesktopMenu from 'components/header/HeaderDesktopMenu.vue'
</script>

<template>
  <q-header elevated>
    <q-toolbar>
      <HeaderLogoComponent/>

      <SearchComponent/>

      <q-space/>

      <HeaderDesktopMenu/>
      <HeaderMobileMenu/>
    </q-toolbar>
  </q-header>
</template>

<style scoped lang="scss">

</style>
