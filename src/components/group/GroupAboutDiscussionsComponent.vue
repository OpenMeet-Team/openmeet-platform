<script setup lang="ts">

import { getImageSrc } from 'src/utils/imageUtils.ts'
import { DiscussionEntity } from 'src/types'
import { useRouter, useRoute } from 'vue-router'
interface Props {
  discussions?: DiscussionEntity[]
}

const router = useRouter()
const route = useRoute()

defineProps<Props>()
</script>

<template>
  <q-card class="shadow-0 q-mt-lg" v-if="discussions?.length">
    <q-card-section>
      <div class="text-h5 row items-center justify-between"><span>Discussions <span v-if="discussions?.length">({{ discussions.length }})</span></span> <q-btn v-if="discussions?.length" no-caps padding="xs" flat label="See all" :to="{ name: 'GroupDiscussionsPage', params: { id: route.params.id }}"/></div>
    </q-card-section>
    <q-card-section v-if="discussions?.length">
      <q-list bordered>
        <q-item v-for="discussion in discussions" :key="discussion.id" clickable>
          <q-item-section avatar>
            <q-avatar size="lg">
              <img :src="getImageSrc(discussion.author.photo, 'https://placehold.co/100')" alt="Author Avatar" />
            </q-avatar>
          </q-item-section>

          <q-item-section>
            <div class="text-weight-bold">{{ discussion.topic }}</div>
            <div class="text-subtitle2">by {{ discussion.author.name }} · {{ discussion.createdAt }}</div>
          </q-item-section>

          <q-item-section side>
            <q-btn flat label="Reply" icon="reply" color="primary" @click="router.push({ name: 'GroupDiscussionsPage', params: {id: route.params.id, discussionId: discussion.id}})" />
          </q-item-section>
        </q-item>
      </q-list>
    </q-card-section>
    <NoContentComponent v-else icon="sym_r_forum" label="No discussions yet"/>
  </q-card>

</template>

<style scoped lang="scss">

</style>
