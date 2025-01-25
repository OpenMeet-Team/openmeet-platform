<template>
  <q-card class="cursor-pointer hover-shadow-1" flat bordered @click="onCategoryClick" data-cy="categories-item-component">
    <q-card-section>
      <h6 class="q-my-none">{{ category.name }}</h6>
    </q-card-section>
  </q-card>
</template>

<script lang="ts" setup>
import { CategoryEntity } from '../../types'
import { useRouter } from 'vue-router'

const props = defineProps<{
  category: CategoryEntity;
}>()

const router = useRouter()

const onCategoryClick = () => {
  router.push({ name: 'EventsPage', query: { category: [props.category.id] } })
}
</script>

<style scoped>
/* Add any custom styles here */
</style>
