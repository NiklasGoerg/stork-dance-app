<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :viewBox="viewBox"
    :width="size"
    :height="size"
    :aria-hidden="title ? undefined : 'true'"
    :role="title ? 'img' : 'presentation'"
    class="base-icon"
  >
    <title v-if="title">{{ title }}</title>
    <path :d="path" fill="currentColor" />
  </svg>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    path: string;
    size?: number | string;
    viewBox?: string;
    title?: string;
  }>(),
  {
    size: 18,
    viewBox: "0 0 24 24",
    title: "",
  },
);
</script>

<style scoped>
.base-icon {
  display: inline-block;
  flex: 0 0 auto;
  vertical-align: middle;
}
</style>
