<script setup lang="ts">

import HeaderNavComponent from '../header/HeaderNavComponent.vue'
import HeaderSignInComponent from '../header/HeaderSignInComponent.vue'
import HeaderProfile from '../header/HeaderProfileComponent.vue'
// import HeaderNotificationsComponent from 'components/header/HeaderNotificationsComponent.vue'
import HeaderDarkModeComponent from '../header/HeaderDarkModeComponent.vue'
</script>

<template>
  <HeaderNavComponent class="q-mr-md gt-xs"/>
  <!-- <HeaderNotificationsComponent/> -->
  <HeaderDarkModeComponent class="q-mr-md gt-xs"/>
  <HeaderSignInComponent class="gt-xs"/>
  <HeaderProfile class="gt-xs"/>
</template>

<style scoped lang="scss">

</style>
