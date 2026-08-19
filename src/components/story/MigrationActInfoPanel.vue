<template>
  <section
    class="migration-info-panel"
    :class="[
      `migration-info-panel--${model.mode}`,
      `migration-info-panel--${model.tone}`,
    ]"
    :aria-label="t('story.migrationPanel.ariaLabel')"
  >
    <div class="migration-info-panel__primary">
      <p v-if="model.status" class="migration-info-panel__status">
        {{ model.status }}
      </p>
      <h1 class="migration-info-panel__title">{{ model.title }}</h1>
      <p v-if="model.instruction" class="migration-info-panel__instruction">
        {{ model.instruction }}
      </p>
      <p v-if="model.detail" class="migration-info-panel__detail">
        {{ model.detail }}
      </p>

      <div
        v-if="model.feedbackTitle || model.feedbackText"
        class="migration-info-panel__feedback"
        aria-live="polite"
        aria-atomic="true"
      >
        <strong v-if="model.feedbackTitle">{{ model.feedbackTitle }}</strong>
        <span v-if="model.feedbackText">{{ model.feedbackText }}</span>
      </div>

      <div
        v-if="model.progress"
        class="migration-info-panel__progress"
        role="status"
        :aria-label="model.progress.label"
      >
        <span
          v-for="index in model.progress.total"
          :key="index"
          class="migration-info-panel__progress-dot"
          :class="{
            'migration-info-panel__progress-dot--complete':
              index <= model.progress.current,
          }"
          aria-hidden="true"
        />
        <span class="migration-info-panel__progress-label">
          {{ model.progress.label }}
        </span>
      </div>
    </div>

    <ol
      v-if="model.movements.length"
      class="migration-info-panel__movements"
      aria-label="Movement sequence"
    >
      <li
        v-for="movement in model.movements"
        :key="movement.id"
        class="migration-info-panel__movement"
        :class="`migration-info-panel__movement--${movement.state}`"
      >
        <span class="migration-info-panel__movement-state">
          {{ getMovementStateLabel(movement.state) }}
        </span>
        <span class="migration-info-panel__movement-label">
          {{ movement.label }}
        </span>
      </li>
    </ol>

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
  MigrationMovementListItem,
} from "~/types/migrationAct";

withDefaults(
  defineProps<{
    model: MigrationActInfoPanelModel;
    showActions?: boolean;
  }>(),
  { showActions: true },
);
defineEmits<{ action: [actionId: MigrationInfoPanelActionId] }>();
const { t } = useI18n();

const getMovementStateLabel = (state: MigrationMovementListItem["state"]) => {
  if (state === "current") return t("story.migrationPanel.current");
  if (state === "completed") {
    return t("story.migrationPanel.completedMovement");
  }
  return t("story.migrationPanel.next");
};
</script>

<style scoped>
.migration-info-panel {
  display: grid;
  grid-template-rows: minmax(0, auto) minmax(0, 1fr) auto;
  gap: clamp(14px, 1.7dvh, 24px);
  width: 100%;
  min-width: 0;
  min-height: 100%;
  color: var(--act4-color-text-strong);
}

.migration-info-panel__primary {
  display: grid;
  align-content: start;
  gap: clamp(8px, 1dvh, 14px);
}

.migration-info-panel__status,
.migration-info-panel__title,
.migration-info-panel__instruction,
.migration-info-panel__detail {
  margin: 0;
}

.migration-info-panel__status {
  color: var(--act4-color-text-muted);
  font-size: 0.78rem;
  font-weight: 850;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.migration-info-panel__title {
  font-size: clamp(2.1rem, 3.2vw, 4.5rem);
  font-weight: 900;
  letter-spacing: -0.035em;
  line-height: 0.95;
}

.migration-info-panel__instruction {
  color: var(--act4-color-text-strong);
  font-size: clamp(1.05rem, 1.3vw, 1.55rem);
  font-weight: 800;
  line-height: 1.15;
}

.migration-info-panel__detail {
  color: var(--act4-color-text-soft);
  font-size: clamp(0.92rem, 1vw, 1.18rem);
  font-weight: 650;
  line-height: 1.3;
}

.migration-info-panel__feedback {
  display: grid;
  gap: 6px;
  margin-top: var(--space-1);
  padding: clamp(13px, 1.4vw, 20px);
  border: 1px solid var(--act4-feedback-neutral-border);
  border-radius: 16px;
  background: var(--act4-feedback-neutral-background);
  color: var(--act4-feedback-neutral-text);
}

.migration-info-panel__feedback strong {
  font-size: clamp(1.4rem, 2vw, 2.4rem);
  line-height: 1;
}

.migration-info-panel__feedback span {
  font-size: clamp(0.92rem, 1.05vw, 1.2rem);
  font-weight: 700;
  line-height: 1.25;
}

.migration-info-panel__progress {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.migration-info-panel__progress-dot {
  width: 18px;
  height: 18px;
  border: 2px solid var(--act4-color-text-muted);
  border-radius: 50%;
}

.migration-info-panel__progress-dot--complete {
  border-color: var(--color-primary);
  background: var(--color-primary);
}

.migration-info-panel__progress-label {
  flex-basis: 100%;
  color: var(--act4-color-text-soft);
  font-weight: 750;
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

.migration-info-panel__movements {
  display: grid;
  align-content: start;
  gap: clamp(8px, 1dvh, 14px);
  min-height: 0;
  margin: 0;
  overflow: auto;
  padding: var(--space-2) 0 0;
  border-top: 1px solid var(--act4-color-border);
  list-style: none;
}

.migration-info-panel__movement {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  align-items: center;
  gap: var(--space-2);
  padding: clamp(10px, 1.2dvh, 16px) clamp(12px, 1.1vw, 18px);
  border: 1px solid transparent;
  border-radius: 10px;
  color: var(--act4-color-text-muted);
}

.migration-info-panel__movement--current {
  border-color: var(--act4-instruction-active-border);
  background: var(--act4-instruction-active-background);
  color: var(--act4-color-text-strong);
  box-shadow: var(--act4-shadow-instruction);
  transform: translateX(2px);
}

.migration-info-panel__movement--completed {
  opacity: 0.72;
}

.migration-info-panel__movement-state {
  font-size: clamp(0.72rem, 0.72vw, 0.92rem);
  font-weight: 850;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.migration-info-panel__movement-label {
  overflow: hidden;
  font-size: clamp(1.05rem, 1.18vw, 1.42rem);
  font-weight: 800;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.migration-info-panel__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px solid var(--act4-color-border);
}

.migration-info-panel--gestureFeedback .migration-info-panel__title,
.migration-info-panel--movementFeedback .migration-info-panel__title,
.migration-info-panel--completed .migration-info-panel__title {
  font-size: clamp(2.8rem, 4.2vw, 5.8rem);
}
</style>
