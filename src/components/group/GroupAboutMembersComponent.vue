<script setup lang="ts">

import { getImageSrc } from 'src/utils/imageUtils.ts'
import { GroupMemberEntity } from 'src/types'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useGroupStore } from 'stores/group-store.ts'
interface Props {
  groupMembers?: GroupMemberEntity[]
}
const props = defineProps<Props>()
const route = useRoute()
const group = computed(() => useGroupStore().group)

const members = computed(() => props.groupMembers?.filter(m => m?.groupRole?.name === 'member'))
</script>

<template>
  <div class="col-12 col-md-6 col-lg-4" v-if="group">
    <q-card class="shadow-0" style="position: sticky; top: 70px;">
      <template v-if="group?.createdBy">
        <q-card-section>
          <div class="text-h5">Organisers</div>
        </q-card-section>
        <q-list style="max-height: 300px" class="scroll">
          <q-item>
            <template v-if="group.createdBy">
              <q-item-section avatar>
                <q-avatar>
                  <img :src="getImageSrc(group.createdBy?.photo, 'https://placehold.co/100')" :alt="group.createdBy?.name">
                </q-avatar>
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ group.createdBy?.name }}dsfsdf</q-item-label>
<!--                <q-item-label caption>{{ member.groupRole.name }}</q-item-label>-->
                <div>
                  <q-btn size="sm" icon="sym_r_mail" flat no-caps color="primary" padding="none" :to="{ name: 'DashboardMessagesPage', query: { user: group.createdBy?.id }}" label="Message"/>
                </div>
              </q-item-section>
            </template>
          </q-item>
        </q-list>
      </template>

      <q-card-section>
        <div class="text-h5 row items-center justify-between"><span>Members <span v-if="group.groupMembersCount">({{ group.groupMembersCount }})</span></span> <q-btn v-if="members?.length" no-caps padding="xs" flat label="See all" :to="{ name: 'GroupMembersPage', params: { id: route.params.id }}"/></div>
      </q-card-section>
      <q-list v-if="group.groupMembers?.length" style="max-height: 300px" class="scroll">
        <q-item v-for="member in group.groupMembers" :key="member.id">
          <q-avatar>
            <img :src="getImageSrc(member.user?.photo, 'https://placehold.co/100')" :alt="member.user?.name">
          </q-avatar>
        </q-item>
      </q-list>
      <NoContentComponent v-else icon="sym_r_group" label="No members of this group yet."/>
    </q-card>
  </div>
</template>

<style scoped lang="scss">

</style>
