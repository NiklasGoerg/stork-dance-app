<template>
  <section
    class="migration-info-panel"
    :class="[
      `migration-info-panel--${model.mode}`,
      `migration-info-panel--${model.tone}`,
    ]"
    :aria-label="t('story.migrationPanel.ariaLabel')"
  >
    <div class="migration-info-panel__content">
      <p
        v-if="visibleNarrationText"
        class="migration-info-panel__narration"
      >
        {{ visibleNarrationText }}
      </p>
    </div>

    <div
      v-if="model.feedbackText"
      class="migration-info-panel__feedback"
      :class="{
        'migration-info-panel__feedback--primary': model.feedbackPrimary,
      }"
      aria-live="polite"
      aria-atomic="true"
    >
      <span>{{ model.feedbackText }}</span>
    </div>

    <div
      v-if="model.progress"
      class="migration-info-panel__progress"
      role="status"
      :aria-label="progressAriaLabel"
    >
      <p class="migration-info-panel__progress-title">
        {{ t("story.migrationPanel.practiceProgress.title") }}
      </p>
      <div class="migration-info-panel__progress-dots">
        <span
          v-for="index in progressDotIndexes"
          :key="index"
          class="migration-info-panel__progress-dot"
          :class="{
            'migration-info-panel__progress-dot--complete':
              index < completedProgressDots,
          }"
          aria-hidden="true"
        />
      </div>
    </div>

    <div
      v-if="showActions && model.actions.length"
      class="migration-info-panel__actions"
    >
      <button
        v-for="action in model.actions"
        :key="action.id"
        class="btn"
        :class="{ 'btn--primary': action.primary }"
        type="button"
        :disabled="action.disabled"
        @click="$emit('action', action.id)"
      >
        {{ action.label }}
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import type {
  MigrationActInfoPanelModel,
  MigrationInfoPanelActionId,
} from "~/types/migrationAct";

const props = withDefaults(
  defineProps<{
    model: MigrationActInfoPanelModel;
    showActions?: boolean;
  }>(),
  { showActions: true },
);
defineEmits<{ action: [actionId: MigrationInfoPanelActionId] }>();
const { t } = useI18n();

const visibleNarrationText = computed(
  () => props.model.instruction || props.model.title,
);
const progressDotIndexes = [0, 1, 2] as const;
const completedProgressDots = computed(() =>
  Math.min(
    progressDotIndexes.length,
    Math.max(0, Math.floor(props.model.progress?.current ?? 0)),
  ),
);
const progressAriaLabel = computed(() => {
  const progress = props.model.progress;
  if (!progress) return "";
  return t("story.migrationPanel.practiceProgress.ariaLabel", {
    current: progress.current,
    total: progress.total,
  });
});
</script>

<style scoped>
.migration-info-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  width: 100%;
  min-width: 0;
  min-height: 100%;
  max-height: 100%;
  overflow: hidden;
  color: var(--act4-color-text-strong);
}

.migration-info-panel__content {
  display: grid;
  align-content: start;
  gap: clamp(12px, 1.4dvh, 20px);
  min-height: 0;
  overflow: auto;
  scrollbar-width: none;
}

.migration-info-panel__content::-webkit-scrollbar {
  width: 0;
  height: 0;
}

.migration-info-panel__narration {
  margin: 0;
  color: var(--act4-color-text-strong);
  max-width: 24ch;
  font-size: clamp(1.65rem, 2.35vw, 3.15rem);
  font-weight: 700;
  line-height: 1.12;
}

.migration-info-panel__feedback {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 3;
  display: grid;
  gap: 6px;
  max-height: min(42%, 220px);
  overflow: hidden;
  padding: clamp(14px, 1.5vw, 22px);
  border: 1px solid var(--act4-feedback-neutral-border);
  border-radius: var(--radius-md);
  background: var(--act4-feedback-neutral-background);
  color: var(--act4-feedback-neutral-text);
  box-shadow: var(--act4-shadow-feedback);
}

.migration-info-panel__feedback span {
  font-size: clamp(1.22rem, 1.58vw, 1.95rem);
  font-weight: 800;
  line-height: 1.16;
}

.migration-info-panel__feedback--primary span {
  font-size: clamp(1.72rem, 2.5vw, 3.35rem);
  font-weight: 900;
  line-height: 1.04;
}

.migration-info-panel__progress {
  position: absolute;
  right: clamp(14px, 1.5vw, 22px);
  bottom: clamp(14px, 1.5vw, 22px);
  z-index: 2;
  display: grid;
  justify-items: end;
  max-width: min(100%, 440px);
  gap: 14px;
  text-align: right;
  pointer-events: none;
}

.migration-info-panel__progress-title {
  margin: 0;
}

.migration-info-panel__progress-title {
  color: var(--act4-color-text-strong);
  font-size: clamp(1.75rem, 2.45vw, 3rem);
  font-weight: 900;
  line-height: 0.95;
}

.migration-info-panel__progress-dots {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 18px;
}

.migration-info-panel__progress-dot {
  width: 56px;
  height: 56px;
  border: 4px solid rgba(11, 52, 41, 0.34);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.54);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.44);
}

.migration-info-panel__progress-dot--complete {
  border-color: var(--color-success);
  background: var(--color-success);
  box-shadow:
    0 0 0 8px rgba(47, 158, 68, 0.14),
    inset 0 0 0 1px rgba(255, 255, 255, 0.3);
}

.migration-info-panel--success .migration-info-panel__feedback {
  border-color: var(--act4-feedback-success-border);
  background: var(--act4-feedback-success-background);
  color: var(--act4-feedback-success-text);
}

.migration-info-panel--warning .migration-info-panel__feedback,
.migration-info-panel--error .migration-info-panel__feedback {
  border-color: var(--act4-feedback-warning-border);
  background: var(--act4-feedback-warning-background);
  color: var(--act4-feedback-warning-text);
}

.migration-info-panel__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: auto;
  padding-top: var(--space-3);
  border-top: 1px solid var(--act4-color-border);
}

.migration-info-panel--completed .migration-info-panel__narration {
  font-size: clamp(2.8rem, 4.2vw, 5.8rem);
}
</style>
