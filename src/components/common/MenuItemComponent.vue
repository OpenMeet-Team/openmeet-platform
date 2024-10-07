<script setup lang="ts">
import { defineEmits, defineProps } from 'vue'

defineOptions({
  name: 'MenuItemComponent'
})

const props = defineProps<{
  icon?: string;
  iconColor?: string;
  label?: string;
  labelColor?: string;
}>()

const emit = defineEmits(['click'])
</script>

<template>
  <q-item v-close-popup clickable v-ripple @click.stop="emit('click')">
    <q-item-section side v-if="props.icon">
      <q-icon :name="props.icon" :color="props.iconColor"/>
    </q-item-section>
    <q-item-section>
      <slot>{{ props.label }}</slot>
    </q-item-section>
  </q-item>
</template>

<style scoped>

</style>
