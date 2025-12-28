<script setup lang="ts">
import { Dark } from 'quasar'
import { Capacitor } from '@capacitor/core'
import { computed } from 'vue'

const isNative = Capacitor.isNativePlatform()

const headerStyle = computed(() => {
  if (isNative) {
    return { paddingTop: 'var(--safe-area-top, 32px)' }
  }
  return {}
})
</script>

<template>
  <q-header bordered :class="[Dark.isActive ? 'bg-dark-page text-white' : 'bg-white text-black']" :style="headerStyle">
    <slot></slot>
  </q-header>
</template>

<style scoped lang="scss">

</style>
