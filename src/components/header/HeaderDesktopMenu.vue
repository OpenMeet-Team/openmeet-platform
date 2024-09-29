<script setup lang="ts">

import HeaderNavComponent from 'components/header/HeaderNavComponent.vue'
import HeaderSignInComponent from 'components/header/HeaderSignInComponent.vue'
import HeaderProfile from 'components/header/HeaderProfileComponent.vue'
import HeaderNotificationsComponent from 'components/header/HeaderNotificationsComponent.vue'
import HeaderDarkModeComponent from 'components/header/HeaderDarkModeComponent.vue'
</script>

<template>
  <HeaderNavComponent class="q-mr-xl gt-sm"/>
  <HeaderNotificationsComponent/>
  <HeaderDarkModeComponent class="q-mr-md gt-sm"/>
  <HeaderSignInComponent class="gt-sm"/>
  <HeaderProfile class="gt-sm"/>
</template>

<style scoped lang="scss">

</style>
