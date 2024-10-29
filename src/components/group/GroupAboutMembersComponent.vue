<script setup lang="ts">

import { getImageSrc } from 'src/utils/imageUtils.ts'
import { GroupMemberEntity } from 'src/types'
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
const { navigateToUser } = useNavigation()
</script>

<template>
  <q-card flat style="position: sticky; top: 70px;" v-if="group">
    <q-card-section>
      <SubtitleComponent hide-link label="Organisers" />
      <q-list>
        <q-item class="q-px-none">
          <template v-if="group.createdBy">
            <q-item-section avatar>
              <q-avatar>
                <img :src="getImageSrc(group.createdBy?.photo)" :alt="group.createdBy?.name">
              </q-avatar>
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ group.createdBy?.name }}</q-item-label>
              <!--                <q-item-label caption>{{ member.groupRole.name }}</q-item-label>-->
              <div>
                <q-btn size="sm" icon="sym_r_mail" flat no-caps color="primary" padding="none"
                  :to="{ name: 'MessagesPage', query: { user: group.createdBy?.id } }" label="Message" />
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
      <div class="cursor-pointer" @click="navigateToUser(member.user?.id)" v-for="member in group.groupMembers"
        :key="member.id">
        <q-avatar size="60px" font-size="52px">
          <img :src="getImageSrc(member.user?.photo)" :alt="member.user?.name">
          <q-badge color="primary" floating>{{ member.groupRole.name }}</q-badge>
          </q-avatar>
        </div>
      </div>
    <NoContentComponent v-else icon="sym_r_group" label="No members of this group yet." />
    </q-card-section>
  </q-card>
</template>

<style scoped lang="scss"></style>
