<!--<script setup lang="ts">-->

<!--import { ref } from 'vue'-->

<!--const search = ref<string>('')-->
<!--const options = ref<never[]>([])-->

<!--const searchRef = ref<InstanceType<typeof HTMLElement> | null>(null)-->

<!--const onSearchClick = () => {-->
<!--  console.log(searchRef)-->
<!--  // searchRef.showPopup()-->
<!--}-->

<!--</script>-->

<!--<template>-->
<!--  <div class="c-search-component row items-center q-mx-md">-->
<!--    <q-select-->
<!--      rounded outlined-->
<!--      ref="searchRef"-->
<!--      class="xs-hide sm-hide"-->
<!--      hide-dropdown-icon-->
<!--      placeholder="Search"-->
<!--      dense-->
<!--      v-model="search"-->
<!--      clearable-->
<!--      use-input-->
<!--      name="search"-->
<!--      input-debounce="1000"-->
<!--      :options="options"-->
<!--      style="width: 250px"-->
<!--      behavior="dialog" autocomplete="">-->
<!--      <template v-slot:prepend>-->
<!--        <q-icon name="search"/>-->
<!--      </template>-->
<!--    </q-select>-->
<!--    <q-icon name="search" class="md-hide lg-hide xl-hide cursor-pointer" size="24px" @click="onSearchClick"/>-->
<!--  </div>-->
<!--</template>-->

<!--<style scoped>-->

<!--</style>-->
