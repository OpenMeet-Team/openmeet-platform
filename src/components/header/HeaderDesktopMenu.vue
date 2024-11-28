<script setup lang="ts">

import HeaderNavComponent from 'components/header/HeaderNavComponent.vue'
import HeaderSignInComponent from 'components/header/HeaderSignInComponent.vue'
import HeaderProfile from 'components/header/HeaderProfileComponent.vue'
// import HeaderNotificationsComponent from 'components/header/HeaderNotificationsComponent.vue'
import HeaderDarkModeComponent from 'components/header/HeaderDarkModeComponent.vue'
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
