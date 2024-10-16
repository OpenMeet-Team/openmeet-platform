<template>
  <q-page v-if="group" class="q-pa-md q-pb-xl">
    <!-- Lead block -->
    <GroupLeadComponent/>

    <!-- Nav sticky block -->
    <GroupStickyComponent/>

    <!-- Secondary blocks -->
    <router-view/>

    <GroupSimilarEventsComponent/>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { LoadingBar } from 'quasar'
import { useRoute } from 'vue-router'
import { useGroupStore } from 'stores/group-store.ts'
import GroupStickyComponent from 'components/group/GroupStickyComponent.vue'
import GroupLeadComponent from 'components/group/GroupLeadComponent.vue'
import GroupSimilarEventsComponent from 'components/group/GroupSimilarEventsComponent.vue'
import { decodeLowercaseStringToNumber } from 'src/utils/encoder.ts'
// import { getImageSrc } from 'src/utils/imageUtils.ts'

const route = useRoute()

const group = computed(() => {
  return useGroupStore().group
})

onMounted(async () => {
  LoadingBar.start()
  const groupId = decodeLowercaseStringToNumber(route.params.id as string)
  useGroupStore().actionGetGroupById(String(groupId)).finally(LoadingBar.stop).then(() => {
    // useMeta({
    //   title: group.value?.name,
    //   meta: {
    //     description: { content: group.value?.description },
    //     'og:image': { content: getImageSrc(group.value?.image) }
    //   }
    // })
  })
})
</script>

<style scoped>

</style>
