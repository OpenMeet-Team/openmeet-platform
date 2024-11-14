<script setup lang="ts">

import { getImageSrc } from 'src/utils/imageUtils.ts'
import { GroupMemberEntity, GroupPermission } from 'src/types'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useGroupStore } from 'stores/group-store.ts'
import SubtitleComponent from '../common/SubtitleComponent.vue'
import { useNavigation } from 'src/composables/useNavigation'
interface Props {
  groupMembers?: GroupMemberEntity[]
}
defineProps<Props>()
const route = useRoute()
const group = computed(() => useGroupStore().group)
const { navigateToMember } = useNavigation()
const onMemberClick = (member: GroupMemberEntity) => {
  if (useGroupStore().getterUserGroupPermission(GroupPermission.SeeMembers)) {
    navigateToMember(member.user?.ulid)
  }
}
</script>

<template>
  <q-card flat style="position: sticky; top: 70px;" v-if="group">
    <q-card-section>
      <SubtitleComponent hide-link label="Organiser" />
      <q-list>
        <q-item class="q-px-none">
          <template v-if="group.createdBy">
            <q-item-section class="cursor-pointer" avatar @click="navigateToMember(group.createdBy?.ulid)">
              <q-avatar>
                <img :src="getImageSrc(group.createdBy?.photo)" :alt="group.createdBy?.name">
              </q-avatar>
            </q-item-section>
            <q-item-section>
              <q-item-label class="cursor-pointer text-body1" @click="navigateToMember(group.createdBy?.ulid)">{{ group.createdBy?.name }}</q-item-label>
              <div>
                <q-btn size="sm" icon="sym_r_mail" flat no-caps color="primary" padding="none" v-if="useGroupStore().getterUserGroupPermission(GroupPermission.MessageMember)"
                  :to="{ name: 'MessagesPage', query: { member: group.createdBy?.shortId } }" label="Message" />
              </div>
            </q-item-section>
          </template>
        </q-item>
      </q-list>
    </q-card-section>

    <q-card-section>
    <SubtitleComponent label="Members"
      :to="{ name: 'GroupMembersPage', params: { id: route.params.id } }" />
    <div class="row q-gutter-md" v-if="group.groupMembers?.length" style="max-height: 300px">
      <div v-for="member in group.groupMembers"
        :key="member.id">
        <q-avatar size="60px" font-size="52px" @click="onMemberClick(member)" :class="{'cursor-pointer': useGroupStore().getterUserGroupPermission(GroupPermission.SeeMembers)}">
          <img :src="getImageSrc(member.user?.photo)" :alt="member.user?.name">
          <q-badge color="primary" v-if="useGroupStore().getterUserGroupPermission(GroupPermission.SeeMembers)" floating>{{ member.groupRole.name }}</q-badge>
          </q-avatar>
        </div>
      </div>
    <NoContentComponent v-else icon="sym_r_group" label="No members of this group yet." />
    </q-card-section>
  </q-card>
</template>

<style scoped lang="scss"></style>
