<script setup lang="ts">

import { useAuthStore } from 'stores/auth-store.ts'
</script>

<template>
  <div class="row q-gutter-md" v-if="!useAuthStore().isAuthenticated">
    <q-btn outline :to="{name: 'AuthLoginPage'}" label="Sign in"/>
    <q-btn color="secondary" :to="{name: 'AuthRegisterPage'}" label="Register"/>
<!--    <MenuItemComponent label="Forgot password" :to="{name: 'AuthForgotPasswordPage'}"/>-->
<!--    <MenuItemComponent label="Restore password" :to="{name: 'AuthRestorePasswordPage'}"/>-->
  </div>
</template>

<style scoped lang="scss">

</style>
