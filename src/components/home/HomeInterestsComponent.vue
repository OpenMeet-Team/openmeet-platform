<template>
  <div class="row q-gutter-md">
    <q-card flat bordered v-for="interest in interests" :key="interest.id" data-cy="interests-item-component">
      <q-card-section>
        <h5 class="q-mb-none">{{ interest.title }}</h5>
        <p>{{ interest.description }}</p>
      </q-card-section>
    </q-card>
  </div>

</template>

<script lang="ts" setup>
import { SubCategoryEntity } from '../../types'

defineProps<{
  interests: SubCategoryEntity[]
}>()
</script>

<style scoped>
/* Add any custom styles here */
</style>
