<script setup lang="ts">
import GroupFormBasicComponent from 'components/group/GroupFormBasicComponent.vue'
import { QDialog } from 'quasar'
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const dialogRef = ref<QDialog | null>(null)
const router = useRouter()
const onSubmit = () => {
  if (dialogRef.value) {
    dialogRef.value.hide()
    router.push({ name: 'DashboardGroupsPage' })
  }
}

const onClose = () => {
  if (dialogRef.value) {
    dialogRef.value.hide()
  }
}
</script>

<template>
<q-dialog ref="dialogRef" persistent>
  <q-card class="full-width q-pa-md" style="max-width: 600px">

    <div class="row q-mb-xl">
      <h1 class="text-h4 q-my-none">Create New Group</h1>
    </div>

    <GroupFormBasicComponent @created="onSubmit" @close="onClose"/>
  </q-card>
</q-dialog>
</template>

<style scoped lang="scss">

</style>
