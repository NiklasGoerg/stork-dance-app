<template>
  <div class="tabs">
    <button
      :class="['tab-btn', { active: modelValue === 'record' }]"
      tabindex="0"
      @click="$emit('update:modelValue', 'record')"
    >
      <BaseIcon :path="mdiRecordCircleOutline" />
      Record Webcam
    </button>
    <button
      :class="['tab-btn', { active: modelValue === 'record-video' }]"
      tabindex="0"
      @click="$emit('update:modelValue', 'record-video')"
    >
      <BaseIcon :path="mdiVideoOutline" />
      Record Video
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
import {
  mdiPlayCircleOutline,
  mdiRecordCircleOutline,
  mdiVideoOutline,
} from "@mdi/js";

import BaseIcon from "~/components/ui/BaseIcon.vue";

type StudioMode = "record" | "record-video" | "playback";

defineProps<{
  modelValue: StudioMode;
}>();

defineEmits<{
  (e: "update:modelValue", value: StudioMode): void;
}>();
</script>
