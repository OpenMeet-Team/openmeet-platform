<script setup lang="ts">
import { ref } from 'vue'
import RegisterComponent from 'components/auth/RegisterComponent.vue'
import { QDialog } from 'quasar'

const dialogRef = ref<QDialog | null>(null)

const onRegister = () => {
  if (dialogRef.value) {
    dialogRef.value.hide()
  }
}
</script>

<template>
  <q-dialog ref="dialogRef">
    <RegisterComponent @register="onRegister"/>
  </q-dialog>
</template>

<style scoped lang="scss">

</style>
