<script setup lang="ts">
import { useAuthStore } from '../../stores/auth-store'
import { useRoute } from 'vue-router'

const route = useRoute()

// Create login/register routes with current page as redirect
const loginRoute = {
  name: 'AuthLoginPage',
  query: { redirect: route.fullPath }
}

const registerRoute = {
  name: 'AuthRegisterPage',
  query: { redirect: route.fullPath }
}
</script>

<template>
  <div class="row q-gutter-md no-wrap" v-if="!useAuthStore().isAuthenticated" data-cy="header-sign-in-component">
    <q-btn rounded no-wrap size="md" data-cy="header-sign-in-button" no-caps outline :to="loginRoute" label="Sign in"/>
    <q-btn rounded size="md" no-caps data-cy="header-register-button" color="secondary" :to="registerRoute" label="Register"/>
  </div>
</template>

<style scoped lang="scss">

</style>
