<template>
  <router-view />
</template>

<script setup lang="ts">
import { Dark } from 'quasar'
import { onBeforeMount } from 'vue'

defineOptions({
  name: 'App'
})

onBeforeMount(() => {
  const storedDarkMode = localStorage.getItem('darkMode')
  if (storedDarkMode !== null) {
    const darkModePreference = storedDarkMode === 'true'
    Dark.set(darkModePreference)
  }
})
</script>
