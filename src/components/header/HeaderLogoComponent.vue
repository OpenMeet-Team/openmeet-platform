<script setup lang="ts">

</script>

<template>
  <q-toolbar-title class="c-header-logo-component" data-cy="header-logo-component">
    <router-link to="/" class="self-center text-inherit no-decoration row items-center">
      <q-img
        src="~assets/openmeet/logo.svg"
        style="height: 45px; width: 45px"
      />
      <div class="text-bold q-ml-sm text-h5">OpenMeet</div>
    </router-link>
  </q-toolbar-title>
</template>

<style scoped lang="scss">
.q-toolbar__title {
  flex: none;
}

.no-decoration {
  text-decoration: none;
}

.text-inherit {
  color: inherit;
}
</style>
