<script setup lang="ts">

import { CategoryEntity, GroupEntity } from 'src/types'
import { useNavigation } from 'src/composables/useNavigation.ts'

interface Props {
  group: GroupEntity
}

defineProps<Props>()

const { navigateToGroup } = useNavigation()

</script>

<template>
  <q-card class="group-card">
    <q-card-section>
      <div class="text-h6">{{ group.name }}</div>
      <div class="text-subtitle2" v-if="group.categories">
        {{ group.categories.map((c: number | CategoryEntity) => typeof c === 'object' ? c.name : '').join(', ') }}
      </div>
    </q-card-section>

<!--    <q-card-section class="q-pt-none" v-if="group.membersCount">-->
<!--      <div class="text-body2">-->
<!--        <q-icon name="sym_r_people" /> {{ group.membersCount }} members-->
<!--      </div>-->
<!--    </q-card-section>-->

    <q-card-actions align="right">
      <q-btn flat color="primary" label="View Group" @click="navigateToGroup(group.slug, group.id)" />
      <q-btn flat color="secondary" label="Join" @click="$emit('join', group.id)" />
    </q-card-actions>
  </q-card>
</template>

<style scoped lang="scss">

</style>
