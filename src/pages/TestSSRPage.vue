<template>
  <div>
    <h1>SSR Test Page</h1>
    <p>Message: {{ message }}</p>
    <p>Config loaded: {{ configStore.isLoaded }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useConfigStore } from 'stores/config-store'

const message = ref('Initial state')
const configStore = useConfigStore()

onMounted(() => {
  message.value = 'Mounted on client'
})
</script>
