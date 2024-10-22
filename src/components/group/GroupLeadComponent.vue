<script setup lang="ts">

import { getImageSrc } from 'src/utils/imageUtils.ts'
import { useGroupStore } from 'stores/group-store.ts'
import ShareComponent from 'components/common/ShareComponent.vue'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { GroupCategoryEntity } from 'src/types'

const group = computed(() => useGroupStore().group)
const router = useRouter()

</script>

<template>
  <div v-if="group" class="row q-col-gutter-md">
    <div class="col-12 col-md-6">
      <q-card flat>
        <q-img :src="getImageSrc(group.image)" :ratio="16/9"/>
      </q-card>
    </div>
    <div class="col-12 col-md-6 column">
      <q-card flat class="col column">
        <q-card-section>
          <div class="text-h4 text-bold q-py-none q-mb-md">{{ group.name }}</div>
          <div class="row items-start no-wrap" v-if="group.location">
            <q-icon size="sm" left name="sym_r_location_on"/>
            <div class="text-body1">{{ group.location }}</div>
          </div>
          <div class="row items-start no-wrap q-mt-xs">
            <q-icon size="sm" left name="sym_r_people"/>
            <div class="text-body1 q-mr-sm">{{ `${group.membersCount || 0 } members` }}</div>|
            <div class="text-body1 q-ml-sm">{{ group.visibility }} group</div>
          </div>
          <div class="row items-start q-mt-xs" v-if="group.createdBy">
            <q-icon size="sm" left name="sym_r_person"/>
            <div class="text-body1">Organised by {{ group.createdBy.name }}</div>
          </div>
        </q-card-section>

        <q-card-section v-if="group.categories">
          <div class="text-h6">Categories</div>
          <div class="q-gutter-sm">
            <q-chip v-for="category in group.categories as GroupCategoryEntity[]" :key="category.id">
              {{ category.name }}
            </q-chip>
          </div>
        </q-card-section>

        <q-card-section class="q-py-none" v-if="useGroupStore().getterUserGroupRole('owner') || useGroupStore().getterUserGroupRole('manager')">
          <q-btn icon="sym_r_edit" size="md" padding="none" no-caps flat label="Edit group info" @click="router.push({ name: 'DashboardGroupPage', params: {id: group.id }})"/>
        </q-card-section>

        <q-space/>

        <q-card-section class="q-pb-none">
          <ShareComponent size="md"/>
        </q-card-section>
      </q-card>
    </div>
  </div>
</template>

<style scoped lang="scss">

</style>
