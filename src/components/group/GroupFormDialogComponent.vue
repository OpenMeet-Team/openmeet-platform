<script setup lang="ts">
import GroupFormComponent from '../group/GroupFormComponent.vue'
import { QDialog } from 'quasar'
import { ref } from 'vue'

const dialogRef = ref<QDialog | null>(null)

const onClose = () => {
  if (dialogRef.value) {
    dialogRef.value.hide()
  }
}
</script>

<template>
<q-dialog class="c-group-form-dialog-component" ref="dialogRef">
  <q-card class="full-width q-pa-md group-form-card" style="max-width: 600px">

    <div class="row q-mb-xl">
      <h1 class="text-h4 q-my-none">Create New Group</h1>
    </div>

    <GroupFormComponent @created="onClose" @close="onClose"/>
  </q-card>
</q-dialog>
</template>

<style scoped lang="scss">
.group-form-card {
  border-radius: 24px;
}
</style>
