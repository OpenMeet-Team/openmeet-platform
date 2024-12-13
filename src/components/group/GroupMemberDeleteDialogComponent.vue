<template>
  <q-dialog ref="dialogRef" persistent>
    <SpinnerComponent v-if="isLoading" />
    <q-card class="full-width" style="max-width: 400px;" v-else>
      <q-card-section>
        <div class="row items-center q-py-sm">
          <q-btn round class="q-mr-md">
            <q-avatar size="48px">
              <img :src="getImageSrc(member.user.photo)" :alt="member.user.name">
            </q-avatar>
          </q-btn>
          <div>
            <q-item-label>{{ member.user.name }}</q-item-label>
            <q-item-label class="text-bold">{{ member.groupRole.name }}</q-item-label>
          </div>
        </div>
      </q-card-section>

      <q-card-section>
        <div class="text-body1">Remove {{ member.user.name }} from this group?</div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat no-caps label="Cancel" v-close-popup />
        <q-btn no-caps color="primary" label="Remove member" v-close-popup @click="onDeleteMember" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { useDialogPluginComponent } from 'quasar'
import { useGroupStore } from 'src/stores/group-store'
import { GroupEntity, GroupMemberEntity } from 'src/types'
import { getImageSrc } from 'src/utils/imageUtils'
import { ref } from 'vue'

interface Props {
  member: GroupMemberEntity
  group: GroupEntity
}

const props = defineProps<Props>()

defineEmits([
  ...useDialogPluginComponent.emits
])

const { dialogRef } = useDialogPluginComponent()

const isLoading = ref(false)

const onDeleteMember = () => {
  isLoading.value = true
  useGroupStore().actionRemoveGroupMember(props.group.slug, props.member.id).finally(() => {
    isLoading.value = false
    dialogRef.value?.hide()
  })
}
</script>
