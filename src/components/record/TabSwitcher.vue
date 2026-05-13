<template>
  <div class="tabs">
    <button
      :class="['tab-btn', { active: modelValue === 'record' }]"
      tabindex="0"
      @click="$emit('update:modelValue', 'record')"
    >
      <BaseIcon :path="mdiRecordCircleOutline" />
      Record
    </button>
    <button
      :class="['tab-btn', { active: modelValue === 'playback' }]"
      tabindex="0"
      @click="$emit('update:modelValue', 'playback')"
    >
      <BaseIcon :path="mdiPlayCircleOutline" />
      Playback
    </button>
  </div>
</template>

<script setup lang="ts">
import { mdiPlayCircleOutline, mdiRecordCircleOutline } from "@mdi/js";

import BaseIcon from "~/components/ui/BaseIcon.vue";

defineProps<{
  modelValue: "record" | "playback";
}>();

defineEmits<{
  (e: "update:modelValue", value: "record" | "playback"): void;
}>();
</script>
