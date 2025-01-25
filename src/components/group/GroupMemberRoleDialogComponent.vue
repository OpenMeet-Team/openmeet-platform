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
                <div class="text-body1">Change the role of {{ member.user.name }} to:</div>
                <div class="column">
                    <q-radio v-model="role" val="admin" label="Admin" />
                    <q-radio v-model="role" val="moderator" label="Moderator" />
                    <q-radio v-model="role" val="member" label="Member" />
                    <q-radio v-model="role" val="guest" label="Guest" />
                </div>
                <p class="text-body1 q-mt-md" v-if="role === 'member'">
                    Members can view discussions, events, and members. They can also create discussions.
                </p>
                <p class="text-body1 q-mt-md" v-else-if="role === 'guest'">
                    Guests can not view discussions, events, or members. They can only request to join the group and wait for approval.
                </p>
                <p class="text-body1 q-mt-md" v-else-if="role === 'moderator'">
                    Moderators can manage members, discussions, events, and the group.
                </p>
                <p class="text-body1 q-mt-md" v-else-if="role === 'admin'">
                    Admins can manage members, discussions, events, and the group. They can also invite new members.
                </p>
                <p class="text-body1 q-mt-md" v-else>
                    You can't change the role of the owner.
                </p>
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
import { groupsApi } from '../../api'
import { useGroupStore } from '../../stores/group-store'
import { GroupEntity, GroupMemberEntity, GroupRole } from '../../types'
import { getImageSrc } from '../../utils/imageUtils'
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

const role = ref<GroupRole>(props.member.groupRole.name)
const isLoading = ref(false)

const onUpdateRole = () => {
  isLoading.value = true

  groupsApi.updateMemberRole(props.group.slug, props.member.id, { name: role.value }).then(res => {
    useGroupStore().actionUpdateGroupMember(res.data)
    dialogRef.value?.hide()
  }).finally(() => {
    isLoading.value = false
  })
}
</script>
