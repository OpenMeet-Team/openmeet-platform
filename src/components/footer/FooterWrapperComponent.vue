<script setup lang="ts">
import { Dark } from 'quasar'
import { Capacitor } from '@capacitor/core'
import { computed } from 'vue'

const isNative = Capacitor.isNativePlatform()

const footerStyle = computed(() => {
  if (isNative) {
    return { paddingBottom: 'var(--safe-area-bottom, 0px)' }
  }
  return {}
})
</script>

<template>
  <q-footer bordered :class="[Dark.isActive ? 'bg-dark-page text-white' : 'bg-purple-600 text-white']" :style="footerStyle">
    <slot></slot>
  </q-footer>
</template>

<style scoped lang="scss">
.q-footer {
  padding-top: 20px;
}

@media (max-width: 599px) {
  .q-footer {
    text-align: center;
  }
}
</style>
