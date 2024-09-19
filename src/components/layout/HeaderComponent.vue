<script setup lang="ts">

import HeaderProfile from 'components/header/HeaderProfileComponent.vue'
import HeaderNavComponent from 'components/header/HeaderNavComponent.vue'
import SearchComponent from 'components/general/SearchComponent.vue'
import HeaderLogoComponent from 'components/header/HeaderLogoComponent.vue'
import HeaderSignInComponent from 'components/header/HeaderSignInComponent.vue'
</script>

<template>
  <q-header elevated>
    <q-toolbar>
      <HeaderLogoComponent/>

      <SearchComponent/>

      <q-space/>

      <HeaderNavComponent/>

      <HeaderSignInComponent/>

      <HeaderProfile/>

    </q-toolbar>
  </q-header>
</template>

<style scoped lang="scss">

</style>
