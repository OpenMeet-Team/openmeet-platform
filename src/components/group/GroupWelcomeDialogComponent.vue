<script setup lang="ts">
import { QDialog } from 'quasar'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { GroupEntity, GroupRole } from 'src/types'

const dialogRef = ref<QDialog | null>(null)
const router = useRouter()
interface Props {
  group: GroupEntity
}

defineProps<Props>()

</script>

<template>
  <q-dialog ref="dialogRef" data-cy="welcome-group-dialog">
    <q-card>
      <q-card-section>
        <div class="text-h6 text-bold">Welcome to the "{{ group.name }}" Group!</div>
        <p class="text-body1 q-mt-md" data-cy="welcome-group-dialog-member"
          v-if="group.groupMember && group.groupMember.groupRole.name === GroupRole.Member">
          You have successfully joined the group. Feel free to explore and participate in discussions, making new connections.
        </p>
        <p class="text-body1 q-mt-md" data-cy="welcome-group-dialog-pending-approval"
          v-else-if="group.groupMember && group.groupMember.groupRole.name === GroupRole.Guest">
          Thank you for your interest in the group. Your request to join has been sent to the group admin for approval.
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
        <q-btn data-cy="welcome-group-dialog-close" no-caps label="Close" color="primary" v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped lang="scss">

</style>
