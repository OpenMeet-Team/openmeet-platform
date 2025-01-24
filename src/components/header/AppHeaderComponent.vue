<script setup lang="ts">
import HeaderWrapperComponent from '../header/HeaderWrapperComponent.vue'
import HeaderDesktopComponent from './HeaderDesktopComponent.vue'
import HeaderMobileComponent from './HeaderMobileComponent.vue'
import { Screen } from 'quasar'
</script>

<template>
  <HeaderWrapperComponent>
    <HeaderDesktopComponent v-if="Screen.width > 891" />
    <HeaderMobileComponent v-else />
  </HeaderWrapperComponent>
</template>

<style scoped lang="scss"></style>
