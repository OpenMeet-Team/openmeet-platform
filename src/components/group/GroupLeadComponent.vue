<script setup lang="ts">

import { getImageSrc } from 'src/utils/imageUtils.ts'
import { useGroupStore } from 'stores/group-store.ts'
import ShareComponent from 'components/common/ShareComponent.vue'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { GroupCategoryEntity, GroupPermission } from 'src/types'
import { useNavigation } from 'src/composables/useNavigation.ts'
import { pluralize } from 'src/utils/stringUtils'
import QRCodeComponent from '../common/QRCodeComponent.vue'

const group = computed(() => useGroupStore().group)
const router = useRouter()
const { navigateToMember } = useNavigation()
</script>

<template>
  <div v-if="group" class="c-group-lead-component row q-col-gutter-md">
    <div class="col-12 col-sm-6">
      <q-card flat>
        <q-img :src="getImageSrc(group.image)" :ratio="16/9"/>
      </q-card>
    </div>
    <div class="col-12 col-sm-6 column">
      <q-card flat class="col column">
        <q-card-section>
          <div class="text-h4 text-bold q-py-none q-mb-md" data-cy="group-name">{{ group.name }}</div>
          <div class="row items-start no-wrap" v-if="group.location">
            <q-icon size="sm" left name="sym_r_location_on" class="text-purple-300"/>
            <div class="text-body1">{{ group.location }}</div>
          </div>
          <div class="row items-start no-wrap q-mt-xs">
            <q-icon size="sm" left name="sym_r_people" class="text-purple-300"/>
            <div class="text-body1 q-mr-sm">{{ group.groupMembersCount }} {{ pluralize(group.groupMembersCount as number, 'member') }}</div>|
            <div class="text-body1 q-ml-sm">{{ group.visibility }} group</div>
          </div>
          <div class="row items-start q-mt-xs" v-if="group.createdBy">
            <q-icon size="sm" left name="sym_r_person" class="text-purple-300"/>
            <div class="text-body1 cursor-pointer">Organised by <span class="router-link-inherit" v-if="group.createdBy" @click.stop="navigateToMember(group.createdBy)">{{ group.createdBy.name }}</span></div>
          </div>
        </q-card-section>

        <q-card-section v-if="group.categories?.length">
          <div class="text-h6">Categories</div>
          <div class="q-gutter-sm">
            <q-chip v-for="category in group.categories as GroupCategoryEntity[]" :key="category.id">
              {{ category.name }}
            </q-chip>
          </div>
        </q-card-section>

        <q-card-section class="q-py-none" v-if="useGroupStore().getterUserHasPermission(GroupPermission.ManageGroup)">
          <q-btn icon="sym_r_edit" size="md" data-cy="edit-group-button" padding="none" no-caps flat label="Edit group info" @click="router.push({ name: 'DashboardGroupPage', params: {id: group.id }})"/>
        </q-card-section>

        <q-space/>

        <q-card-section>
          <ShareComponent size="md"/>
        </q-card-section>

        <q-card-section>
          <QRCodeComponent class="" />
        </q-card-section>
      </q-card>
    </div>
  </div>
</template>

<style scoped lang="scss">

</style>
