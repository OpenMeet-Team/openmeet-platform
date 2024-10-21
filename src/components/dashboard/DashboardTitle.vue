<template>
  <div class="row items-center justify-between q-mb-xl">
    <div class="columns items-center row">
      <router-link
        v-if="backTo"
        :to="backTo"
        class="text-primary text-h6 router-link-inherit q-mr-md"
      >
        <q-icon size="md" name="sym_r_arrow_back" left/> Back
      </router-link>
      <h4 class="text-h4 text-bold q-my-none" v-if="label">{{ label }}</h4>
    </div>
    <slot></slot>
  </div>

</template>

<script lang="ts" setup>
import { RouteLocationRaw } from 'vue-router'

interface Props {
  backTo?: RouteLocationRaw
  label?: string
}

defineProps<Props>()

</script>

<style scoped>
/* Add any specific styling here */
</style>
