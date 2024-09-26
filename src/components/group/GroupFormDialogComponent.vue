<script setup lang="ts">

import GroupFormComponent from 'components/group/GroupFormComponent.vue'
</script>

<template>
<q-dialog>
  <q-card class="full-width q-pa-md" style="max-width: 600px">
    <q-card-section>
      <div class="text-h6">Create new Group</div>
    </q-card-section>

    <GroupFormComponent/>
  </q-card>
</q-dialog>
</template>

<style scoped lang="scss">

</style>
