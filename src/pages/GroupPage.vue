<template>
  <q-page v-if="group" class="q-pa-md q-pb-xl">
    <!-- Lead block -->
    <GroupLeadComponent/>

    <!-- Nav sticky block -->
    <GroupStickyComponent/>

    <!-- Secondary blocks -->
    <router-view/>

    <GroupSimilarEventsComponent v-if="group" :group="group"/>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { LoadingBar, useMeta } from 'quasar'
import { useRoute } from 'vue-router'
import { useGroupStore } from 'stores/group-store.ts'
import GroupStickyComponent from 'components/group/GroupStickyComponent.vue'
import GroupLeadComponent from 'components/group/GroupLeadComponent.vue'
import GroupSimilarEventsComponent from 'components/group/GroupSimilarEventsComponent.vue'
import { decodeLowercaseStringToNumber } from 'src/utils/encoder.ts'
import { getImageSrc } from 'src/utils/imageUtils.ts'

const route = useRoute()

const group = computed(() => {
  return useGroupStore().group
})

onBeforeUnmount(() => {
  useGroupStore().$reset()
})

onMounted(async () => {
  LoadingBar.start()
  const groupId = decodeLowercaseStringToNumber(route.params.id as string)
  useGroupStore().actionGetGroupById(String(groupId)).finally(LoadingBar.stop).then(() => {
    const group = useGroupStore().group

    if (group) {
      useMeta({
        title: group.name,
        meta: {
          description: { content: group.description },
          'og:image': { content: getImageSrc(group.image) }
        }
      })
    }
  })
})

onBeforeUnmount(() => {
  useGroupStore().$reset()
})
</script>

<style scoped>

</style>
