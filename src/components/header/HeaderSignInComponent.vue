<script setup lang="ts">

import { useAuthStore } from 'stores/auth-store.ts'
import { useAuthDialog } from 'src/composables/useAuthDialog.ts'
const authDialog = useAuthDialog()
const onLogin = () => {
  authDialog.openLoginDialog()
}

const onRegister = () => {
  authDialog.openRegisterDialog()
}
</script>

<template>
  <div class="row q-gutter-md no-wrap" v-if="!useAuthStore().isAuthenticated" data-cy="header-sign-in-component">
<!--    <q-btn size="md" no-caps outline :to="{name: 'AuthLoginPage'}" label="Sign in"/>-->
    <q-btn rounded no-wrap size="md" data-cy="header-sign-in-button" no-caps outline @click="onLogin" label="Sign in"/>
<!--    <q-btn size="md" no-caps color="secondary"  :to="{name: 'AuthRegisterPage'}" label="Register"/>-->
    <q-btn rounded size="md" no-caps data-cy="header-register-button" color="secondary"  @click="onRegister" label="Register"/>
  </div>
</template>

<style scoped lang="scss">

</style>
