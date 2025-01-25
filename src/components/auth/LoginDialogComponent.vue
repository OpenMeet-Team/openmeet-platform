<script setup lang="ts">
import { ref } from 'vue'
import LoginComponent from '../auth/LoginComponent.vue'
import { QDialog } from 'quasar'

const dialogRef = ref<QDialog | null>(null)

const onLogin = () => {
  if (dialogRef.value) {
    dialogRef.value.hide()
    // window.location.reload()
  }
}

</script>

<template>
  <q-dialog ref="dialogRef">
    <LoginComponent @login="onLogin"/>
  </q-dialog>
</template>

<style scoped lang="scss">

</style>
