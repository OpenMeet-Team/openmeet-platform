<script setup lang="ts">

</script>

<template>
  <div class="row q-gutter-md">
    <q-btn outline :to="{name: 'AuthLoginPage'}" label="Sign in"/>
    <q-btn color="secondary" :to="{name: 'AuthRegisterPage'}" label="Register"/>
<!--    <MenuItemComponent label="Forgot password" :to="{name: 'AuthForgotPasswordPage'}"/>-->
<!--    <MenuItemComponent label="Restore password" :to="{name: 'AuthRestorePasswordPage'}"/>-->
  </div>
</template>

<style scoped lang="scss">

</style>
