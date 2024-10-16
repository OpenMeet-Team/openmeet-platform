<script setup lang="ts">

import { getImageSrc } from 'src/utils/imageUtils.ts'
import { GroupMemberEntity } from 'src/types'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
interface Props {
  groupMembers?: GroupMemberEntity[]
}
const props = defineProps<Props>()
const route = useRoute()

const organisers = computed(() => props.groupMembers?.filter(m => m?.groupRole?.name !== 'member'))
const members = computed(() => props.groupMembers?.filter(m => m?.groupRole?.name === 'member'))
</script>

<template>
  <div class="col-12 col-md-6 col-lg-4">
    <q-card class="shadow-0" style="position: sticky; top: 70px;">
      <template v-if="organisers?.length">
        <q-card-section>
          <div class="text-h5">Organisers</div>
        </q-card-section>
        <q-list style="max-height: 300px" class="scroll">
          <q-item v-for="member in organisers" :key="member.id">
            <template v-if="member.user">
              <q-item-section avatar>
                <q-avatar>
                  <img :src="getImageSrc(member.user?.photo, 'https://placehold.co/100')" :alt="member.user?.name">
                </q-avatar>
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ member.user?.name }}</q-item-label>
                <q-item-label caption>{{ member.groupRole.name }}</q-item-label>
                <router-link :to="{ name: 'DashboardMessagesPage', query: { user: member.user?.id }}"><q-icon name="sym_r_mail" left/>Message</router-link>
              </q-item-section>
            </template>
          </q-item>
        </q-list>
      </template>

      <q-card-section>
        <div class="text-h5 row justify-between">Members <span v-if="members?.length">({{ members.length }})</span> <q-btn v-if="members?.length" no-caps flat label="See all" :to="{ name: 'GroupMembersPage', params: { id: route.params.id }}"/></div>
      </q-card-section>
      <q-list v-if="members?.length" style="max-height: 300px" class="scroll">
        <q-item v-for="member in members" :key="member.id">
          <q-avatar>
            <img :src="getImageSrc(member.user.photo, 'https://placehold.co/100')" :alt="member.user.name">
          </q-avatar>
        </q-item>
      </q-list>
      <NoContentComponent v-else icon="sym_r_group" label="No members of this group yet."/>
    </q-card>
  </div>
</template>

<style scoped lang="scss">

</style>
