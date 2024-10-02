<script setup lang="ts">
import GroupFormBasicComponent from 'components/group/GroupFormBasicComponent.vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const onSubmit = () => {
  router.push({ name: 'GroupPage' })
}
</script>

<template>
<q-dialog>
  <q-card class="full-width q-pa-md" style="max-width: 600px">

    <div class="row q-mb-xl">
      <h1 class="text-h4 q-my-none">Create New Group</h1>
    </div>

    <GroupFormBasicComponent @submit="onSubmit"/>
  </q-card>
</q-dialog>
</template>

<style scoped lang="scss">

</style>
