<script setup lang="ts">

import { getImageSrc } from '../../utils/imageUtils'
import { GroupMemberEntity, GroupPermission, GroupRole } from '../../types'
import { computed, onMounted } from 'vue'
import { useGroupStore } from '../../stores/group-store'
import SubtitleComponent from '../common/SubtitleComponent.vue'
import NoContentComponent from '../global/NoContentComponent.vue'
import { useNavigation } from '../../composables/useNavigation'

const group = computed(() => useGroupStore().group)
const { navigateToMember } = useNavigation()

// Load members data if not already loaded
onMounted(() => {
  if (group.value && !group.value.groupMembers) {
    useGroupStore().actionGetGroupMembers(group.value.slug)
  }
})

const onMemberClick = (member: GroupMemberEntity) => {
  if (useGroupStore().getterUserHasPermission(GroupPermission.SeeMembers)) {
    navigateToMember(member.user)
  }
}

</script>

<template>
  <q-card flat style="position: sticky; top: 70px;" v-if="group">
    <q-card-section>
      <SubtitleComponent hide-link label="Organizer" />
      <q-list>
        <q-item class="q-px-none">
          <template v-if="group.createdBy">
            <q-item-section class="cursor-pointer" avatar @click="navigateToMember(group.createdBy)">
              <q-avatar>
                <img :src="getImageSrc(group.createdBy?.photo)" :alt="group.createdBy?.name">
              </q-avatar>
            </q-item-section>
            <q-item-section>
              <q-item-label class="cursor-pointer text-body1" @click="navigateToMember(group.createdBy)">{{ group.createdBy?.name }}</q-item-label>
              <div>
                <q-btn size="sm" icon="sym_r_mail" flat no-caps color="primary" padding="none" v-if="useGroupStore().getterUserHasPermission(GroupPermission.MessageMember)"
                  :to="{ name: 'DashboardChatsPage', query: { member: group.createdBy?.shortId } }" label="Message" />
              </div>
            </q-item-section>
          </template>
        </q-item>
      </q-list>
    </q-card-section>

    <q-card-section>
    <SubtitleComponent label="Members" :count="group.groupMembersCount"
      :to="{ name: 'GroupMembersPage' }" />
    <div class="row q-gutter-md" v-if="group.groupMembers?.length" style="max-height: 300px">
      <div v-for="member in group.groupMembers"
        :key="member.id">
        <q-avatar size="60px" font-size="52px" @click="onMemberClick(member)" :class="{'cursor-pointer': useGroupStore().getterUserHasPermission(GroupPermission.SeeMembers)}">
          <img :src="getImageSrc(member.user?.photo)" :alt="member.user?.name">
          <q-badge color="primary" v-if="[GroupRole.Admin, GroupRole.Moderator, GroupRole.Owner].includes(member.groupRole.name)" floating>{{ member.groupRole.name }}</q-badge>
          </q-avatar>
        </div>
      </div>
    <NoContentComponent v-else-if="group.groupMembers !== null" icon="sym_r_group" label="No members of this group yet." />
    <div v-else class="text-center q-pa-md">
      <q-spinner size="2em" />
      <div class="text-caption q-mt-sm">Loading members...</div>
    </div>
    </q-card-section>
  </q-card>
</template>

<style scoped lang="scss"></style>
