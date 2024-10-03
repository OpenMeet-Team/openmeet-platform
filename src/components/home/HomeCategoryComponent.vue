<template>
  <div class="q-pa-md">
    <q-card flat bordered>
      <q-card-section>
        <h6 class="q-my-none">{{ category.name }}</h6>
      </q-card-section>
    </q-card>
  </div>
</template>

<script lang="ts" setup>
interface Category {
  name: string;
}

defineProps<{
  category: Category;
}>()
</script>

<style scoped>
/* Add any custom styles here */
</style>
