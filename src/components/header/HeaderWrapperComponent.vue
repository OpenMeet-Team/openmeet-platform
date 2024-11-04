<script setup lang="ts">
import { Dark } from 'quasar'
</script>

<template>
  <q-header bordered :class="[Dark.isActive ? 'bg-dark-page text-white' : 'bg-white text-black']">
    <slot></slot>
  </q-header>
</template>

<style scoped lang="scss">

</style>
