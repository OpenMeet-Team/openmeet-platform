<template>
    <q-dialog ref="dialogRef" persistent>
        <q-card class="full-width" style="max-width: 400px;">
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
                <div class="text-body1">Change the role of {{ member.user.name }} to:</div>
                <div class="column">
                    <q-radio v-model="role" val="admin" label="Admin" />
                    <q-radio v-model="role" val="moderator" label="Moderator" />
                    <q-radio v-model="role" val="member" label="Member" />
                    <q-radio v-model="role" val="guest" label="Guest" />
                </div>
            </q-card-section>

            <q-card-actions align="right">
                <q-btn flat no-caps label="Cancel" v-close-popup />
                <q-btn no-caps color="primary" label="Update role" v-close-popup @click="onUpdateRole" />
            </q-card-actions>
        </q-card>
    </q-dialog>
</template>

<script setup lang="ts">
import { useDialogPluginComponent } from 'quasar'
import { groupsApi } from 'src/api'
import { useGroupStore } from 'src/stores/group-store'
import { GroupEntity, GroupMemberEntity, GroupRoleType } from 'src/types'
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

const role = ref<GroupRoleType>(props.member.groupRole.name)
const isLoading = ref(false)

const onUpdateRole = () => {
  isLoading.value = true

  groupsApi.updateMemberRole(props.group.id, props.member.user.id, { name: role.value }).then(res => {
    useGroupStore().actionUpdateGroupMember(res.data)
    dialogRef.value?.hide()
  }).finally(() => {
    isLoading.value = false
  })
}
</script>
