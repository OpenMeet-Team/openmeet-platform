<script setup lang="ts">
import HeaderLogoComponent from 'components/header/HeaderLogoComponent.vue'
import HeaderWrapperComponent from 'components/header/HeaderWrapperComponent.vue'
import HeaderProfileComponent from 'components/header/HeaderProfileComponent.vue'
</script>

<template>
  <HeaderWrapperComponent>
    <q-toolbar>
      <HeaderLogoComponent/>
      <q-space/>
      <HeaderProfileComponent class="gt-sm"/>
    </q-toolbar>
  </HeaderWrapperComponent>
</template>

<style scoped lang="scss">

</style>
