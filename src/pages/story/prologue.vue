<template>
  <StoryActRuntimePlaceholder :act="prologue" />
</template>

<script setup lang="ts">
import StoryActRuntimePlaceholder from "~/components/story/StoryActRuntimePlaceholder.vue";
import { prologue } from "~/story/acts/prologue";
</script>
