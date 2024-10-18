<script setup lang="ts">
import { QDialog } from 'quasar'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { GroupEntity } from 'src/types'

const dialogRef = ref<QDialog | null>(null)
const router = useRouter()
interface Props {
  group: GroupEntity
}

defineProps<Props>()

</script>

<template>
  <q-dialog ref="dialogRef">
    <q-card>
      <q-card-section>
        <div class="text-h5">Welcome to the "{{ group.name }}" Group!</div>
        <p class="text-body1 q-mt-md">
          You have successfully joined the group. Feel free to explore and participate in discussions, making new connections.
        </p>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn
          no-caps
          label="Find other groups"
          @click="router.push({ name: 'GroupsPage' })"
          flat
          v-close-popup
        />
        <q-btn no-caps label="Close" color="primary" v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped lang="scss">

</style>
