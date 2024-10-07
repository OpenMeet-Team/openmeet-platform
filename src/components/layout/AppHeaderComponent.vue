<script setup lang="ts">
import HeaderSearchComponent from 'components/header/HeaderSearchComponent.vue'
import HeaderLogoComponent from 'components/header/HeaderLogoComponent.vue'
import HeaderMobileMenu from 'components/header/HeaderMobileMenu.vue'
import HeaderDesktopMenu from 'components/header/HeaderDesktopMenu.vue'
import HeaderWrapperComponent from 'components/layout/HeaderWrapperComponent.vue'
</script>

<template>
  <HeaderWrapperComponent>
    <q-toolbar>
      <HeaderLogoComponent/>

      <HeaderSearchComponent/>

      <q-space/>

      <HeaderDesktopMenu/>
      <HeaderMobileMenu/>
    </q-toolbar>
  </HeaderWrapperComponent>
</template>

<style scoped lang="scss">

</style>
