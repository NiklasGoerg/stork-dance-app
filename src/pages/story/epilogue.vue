<template>
  <StoryActRuntimePlaceholder :act="epilogue" />
</template>

<script setup lang="ts">
import StoryActRuntimePlaceholder from "~/components/story/StoryActRuntimePlaceholder.vue";
import { epilogue } from "~/story/acts/epilogue";
</script>
