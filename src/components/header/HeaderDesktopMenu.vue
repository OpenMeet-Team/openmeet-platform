<script setup lang="ts">

import HeaderNavComponent from 'components/header/HeaderNavComponent.vue'
import HeaderSignInComponent from 'components/header/HeaderSignInComponent.vue'
import HeaderProfile from 'components/header/HeaderProfileComponent.vue'
import HeaderNotificationsComponent from 'components/header/HeaderNotificationsComponent.vue'
</script>

<template>
  <HeaderNavComponent class="q-mr-xl gt-sm"/>
  <HeaderNotificationsComponent/>
  <HeaderSignInComponent class="gt-sm"/>
  <HeaderProfile class="gt-sm"/>
</template>

<style scoped lang="scss">

</style>
