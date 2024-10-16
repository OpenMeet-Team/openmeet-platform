<script setup lang="ts">

import { getImageSrc } from 'src/utils/imageUtils.ts'
import { useGroupStore } from 'stores/group-store.ts'
import ShareComponent from 'components/common/ShareComponent.vue'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const group = computed(() => useGroupStore().group)
const route = useRoute()
const router = useRouter()

</script>

<template>
  <div v-if="group" class="row q-col-gutter-md">
    <div class="col-12 col-md-6">
      <q-card class="shadow-0">
        <q-img :src="getImageSrc(group.image)" :ratio="16/9"/>
      </q-card>
    </div>
    <div class="col-12 col-md-6 column">
      <q-card class="col column shadow-0">
        <q-card-section>
          <div class="text-h4">{{ group.name }}</div>
          <div class="text-subtitle2 row items-center no-wrap" v-if="group.location">
            <q-icon size="xs" left name="sym_r_location_on"/>
            <div style="max-width: 80%" :title="group.location" class="ellipsis overflow-hidden">{{ group.location }}</div>
          </div>
          <div class="q-mt-md">
            <q-badge class="q-mr-md" color="primary" v-if="group.membersCount"
                     :label="`${group.membersCount} members`"/>
            <q-badge color="secondary" label="Public group"/>
          </div>
          <div class="q-mt-md text-caption" v-if="group.createdBy && group.createdBy.name">Organized by {{
              group.createdBy.name
            }}
          </div>
        </q-card-section>

        <q-card-section v-if="group.categories">
          <div class="text-h6">Categories</div>
          <div class="q-gutter-sm">
            <q-chip v-for="category in group.categories" :key="category.id">
              {{ category.name }}
            </q-chip>
          </div>
        </q-card-section>

        <q-card-section v-if="useGroupStore().getterUserGroupRole('owner')">
          <q-btn icon="sym_r_edit" size="md" padding="none" no-caps flat label="Edit group info" @click="router.push({ name: 'DashboardGroupPage', params: {id: route.params.id }})"/>
        </q-card-section>

        <q-card-section class="q-mt-auto">
          <ShareComponent size="md"/>
        </q-card-section>
      </q-card>
    </div>
  </div>
</template>

<style scoped lang="scss">

</style>
