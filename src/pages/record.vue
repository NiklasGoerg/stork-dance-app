<template>
  <div :class="['page', { 'page--playback': mode === 'playback' }]">
    <!-- CAMERA -->
    <MovementCamera
      v-if="mode === 'record'"
      mode="silhouette"
      :show-hands="false"
    />
    <div v-if="mode === 'playback'" class="playback-stage-wrap">
      <PlaybackCanvas
        class="playback-stage"
        :current-frame="recordPlayback.currentFrame.value"
        :source-aspect="recordPlayback.sourceAspect.value"
      />
    </div>

    <!-- UI Overlay: Modern Card Design -->
    <div class="overlay">
      <div
        :class="[
          'panel-shell',
          {
            'panel-shell--playback': mode === 'playback',
            'panel-shell--collapsed': isPanelCollapsed,
          },
        ]"
      >
        <div class="panel-header">
          <TabSwitcher v-model="mode" />
          <button
            class="btn icon-btn panel-toggle"
            type="button"
            :aria-expanded="!isPanelCollapsed"
            aria-controls="record-panel-content"
            :title="panelToggleTitle"
            @click="isPanelCollapsed = !isPanelCollapsed"
          >
            <BaseIcon :path="panelToggleIcon" :title="panelToggleTitle" />
            <span class="sr-only">{{ panelToggleLabel }}</span>
          </button>
        </div>

        <div
          v-show="!isPanelCollapsed"
          id="record-panel-content"
          class="tab-content"
        >
          <RecordControls v-if="mode === 'record'" />
          <VideoMovementRecorder v-if="mode === 'record-video'" />
          <PlaybackControls
            v-if="mode === 'playback'"
            :assets="recordPlayback.assets"
            :selected-asset-id="recordPlayback.selectedAssetId.value"
            :source-name="recordPlayback.sourceName.value"
            :recording="recordPlayback.recording.value"
            :has-recording="recordPlayback.hasRecording.value"
            :is-playing="recordPlayback.isPlaying.value"
            :has-completed="recordPlayback.hasCompleted.value"
            :current-time-ms="recordPlayback.currentTimeMs.value"
            :duration-ms="recordPlayback.durationMs.value"
            @load-asset="recordPlayback.loadAsset"
            @load-uploaded-recording="recordPlayback.loadUploadedRecording"
            @play="recordPlayback.play"
            @pause="recordPlayback.pause"
            @reset="recordPlayback.reset"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { mdiChevronDown, mdiChevronUp } from "@mdi/js";

import MovementCamera from "~/components/movement/MovementCamera.vue";
import PlaybackCanvas from "~/components/record/PlaybackCanvas.vue";

import BaseIcon from "~/components/ui/BaseIcon.vue";
import TabSwitcher from "~/components/record/TabSwitcher.vue";
import RecordControls from "~/components/record/RecordControls.vue";
import VideoMovementRecorder from "~/components/record/VideoMovementRecorder.vue";
import PlaybackControls from "~/components/record/PlaybackControls.vue";
import { useRecordMovementPlayback } from "~/composables/useRecordMovementPlayback";

type StudioMode = "record" | "record-video" | "playback";

const mode = ref<StudioMode>("record");
const isPanelCollapsed = ref(false);
const recordPlayback = useRecordMovementPlayback();
const { t } = useI18n();

const panelToggleIcon = computed(() =>
  isPanelCollapsed.value ? mdiChevronDown : mdiChevronUp,
);
const panelToggleLabel = computed(() =>
  isPanelCollapsed.value
    ? t("record.panel.expand")
    : t("record.panel.collapse"),
);
const panelToggleTitle = computed(() =>
  isPanelCollapsed.value
    ? t("record.panel.expandTitle")
    : t("record.panel.collapseTitle"),
);
</script>

<style scoped>
.page {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #000;
}

.page--playback {
  background: #fff;
}

.playback-stage-wrap {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
}

.playback-stage {
  width: min(calc(100vw - 48px), calc((100vh - 48px) * 16 / 9));
  aspect-ratio: 16 / 9;
  height: auto;
  max-height: calc(100vh - 48px);
  border-radius: var(--radius-sm);
  overflow: hidden;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.28);
}

.overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  padding: 24px;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  pointer-events: none;
  z-index: 20;
}

.panel-shell {
  margin: 0;
  pointer-events: auto;
}

.panel-shell--playback {
  width: min(460px, calc(100vw - 48px));
  max-width: min(460px, calc(100vw - 48px));
}

.panel-shell--collapsed {
  padding-bottom: 28px;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.panel-header :deep(.tabs) {
  flex: 1;
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.panel-header :deep(.tab-btn) {
  min-width: 0;
  justify-content: center;
  padding-inline: 8px;
  text-align: center;
  white-space: normal;
  line-height: 1.12;
  font-size: 0.86rem;
}

.panel-toggle {
  flex: 0 0 auto;
}

.tab-content {
  margin-top: 2px;
  display: flex;
  min-width: 0;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 760px) {
  .playback-stage-wrap {
    padding: 10px;
  }

  .playback-stage {
    width: min(calc(100vw - 20px), calc((100vh - 20px) * 16 / 9));
    max-height: calc(100vh - 20px);
  }

  .overlay {
    padding: 10px;
  }

  .panel-shell {
    width: 100%;
  }

  .panel-shell--playback {
    width: calc(100vw - 20px);
    max-width: calc(100vw - 20px);
  }

  .panel-header :deep(.tab-btn) {
    padding-inline: 10px;
  }
}
</style>
