<template>
  <div class="tabs">
    <button
      :class="['tab-btn', { active: modelValue === 'record' }]"
      tabindex="0"
      @click="$emit('update:modelValue', 'record')"
    >
      <BaseIcon :path="mdiRecordCircleOutline" />
      {{ t("record.tabs.recordWebcam") }}
    </button>
    <button
      :class="['tab-btn', { active: modelValue === 'record-video' }]"
      tabindex="0"
      @click="$emit('update:modelValue', 'record-video')"
    >
      <BaseIcon :path="mdiVideoOutline" />
      {{ t("record.tabs.recordVideo") }}
    </button>
    <button
      :class="['tab-btn', { active: modelValue === 'playback' }]"
      tabindex="0"
      @click="$emit('update:modelValue', 'playback')"
    >
      <BaseIcon :path="mdiPlayCircleOutline" />
      {{ t("record.tabs.playback") }}
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

const { t } = useI18n();

type StudioMode = "record" | "record-video" | "playback";

defineProps<{
  modelValue: StudioMode;
}>();

defineEmits<{
  (e: "update:modelValue", value: StudioMode): void;
}>();
</script>
