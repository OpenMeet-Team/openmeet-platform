<template>
  <div class="row">
    <div class="q-pa-md" v-for="interest in interests" :key="interest.id">
      <q-card flat bordered>
        <q-card-section>
          <h5 class="q-mb-none">{{ interest.title }}</h5>
                    <p>{{ interest.description }}</p>
        </q-card-section>
      </q-card>
    </div>
  </div>

</template>

<script lang="ts" setup>
import { SubCategoryEntity } from 'src/types'

defineProps<{
  interests: SubCategoryEntity[]
}>()
</script>

<style scoped>
/* Add any custom styles here */
</style>
