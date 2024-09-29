<script setup lang="ts">

import { useAuthStore } from 'stores/auth-store.ts'
</script>

<template>
  <div class="row q-gutter-md" v-if="!useAuthStore().isAuthenticated">
    <q-btn size="md" no-caps outline :to="{name: 'AuthLoginPage'}" label="Sign in"/>
    <q-btn size="md" no-caps color="secondary"  :to="{name: 'AuthRegisterPage'}" label="Register"/>
  </div>
</template>

<style scoped lang="scss">

</style>
