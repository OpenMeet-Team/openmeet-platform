<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()

// Create login route with current page as redirect
const loginRoute = {
  name: 'AuthLoginPage',
  query: { redirect: route.fullPath }
}
</script>

<template>
  <router-link class="router-link-inherit text-bold text-primary" :to="loginRoute">
    Login
  </router-link>
</template>

<style scoped lang="scss">

</style>
