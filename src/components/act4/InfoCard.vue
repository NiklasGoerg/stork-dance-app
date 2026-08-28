<template>
  <section
    class="act4-info-card"
    :class="`act4-info-card--${model.mode}`"
    :aria-label="t('story.acts.act4.infoCard.aria.card')"
  >
    <section
      v-if="model.mode === 'completed'"
      class="act4-info-card__completion"
      :aria-label="t('story.acts.act4.infoCard.aria.completion')"
    >
      <p class="act4-info-card__completion-title">
        {{ model.completion?.title }}
      </p>
      <p
        v-if="model.completion?.subtitle"
        class="act4-info-card__completion-subtitle"
      >
        {{ model.completion.subtitle }}
      </p>
    </section>

    <section
      v-else-if="model.mode === 'periodTransition'"
      class="act4-info-card__period-transition"
      :aria-label="t('story.acts.act4.infoCard.aria.periodTransition')"
    >
      <p class="act4-info-card__transition-label">
        {{ t("story.acts.act4.infoCard.periodShift") }}
      </p>
      <div class="act4-info-card__transition-periods">
        <span class="act4-info-card__transition-period">
          {{ model.periodTransition?.previousPeriod }}
        </span>
        <span class="act4-info-card__transition-arrow" aria-hidden="true">
          &rarr;
        </span>
        <span
          class="act4-info-card__transition-period act4-info-card__transition-period--next"
        >
          {{ model.periodTransition?.nextPeriod }}
        </span>
      </div>
    </section>

    <section
      v-else-if="model.mode === 'narration'"
      class="act4-info-card__narration"
      :aria-label="t('story.acts.act4.infoCard.aria.narration')"
    >
      <p
        class="act4-info-card__narration-text"
        :class="`act4-info-card__narration-text--${model.displayTone}`"
      >
        {{ model.narration?.text ?? model.displayText }}
      </p>
    </section>

    <div v-else class="act4-info-card__data-content">
      <section
        class="act4-info-card__focus"
        :aria-label="t('story.acts.act4.infoCard.aria.currentTarget')"
      >
        <p class="act4-info-card__season">{{ model.seasonLabel }}</p>
        <p class="act4-info-card__movement">
          {{ model.movementPercentLabel }}
        </p>
      </section>

      <section
        class="act4-info-card__climate"
        :aria-label="t('story.acts.act4.infoCard.aria.currentClimateData')"
      >
        <p class="act4-info-card__period">{{ model.periodLabel }}</p>
        <p
          v-if="model.temperature.isBaseline"
          class="act4-info-card__period-context"
        >
          {{ t("story.acts.act4.climateInfo.referencePeriod") }}
        </p>
        <p
          v-if="model.temperature.valueLabel"
          class="act4-info-card__temperature"
        >
          <span class="act4-info-card__temperature-value">
            <span v-if="!model.temperature.isBaseline" aria-hidden="true">
              &Delta;
            </span>
            <strong>{{ model.temperature.valueLabel }}</strong>
          </span>
          <span
            v-if="model.temperature.contextLabel"
            class="act4-info-card__temperature-context"
          >
            {{ model.temperature.contextLabel }}
          </span>
          <span
            v-else-if="model.temperature.baselineLabel"
            class="act4-info-card__temperature-baseline"
          >
            {{
              t("story.acts.act4.infoCard.vs", {
                value: model.temperature.baselineLabel,
              })
            }}
          </span>
        </p>
      </section>

      <p
        v-if="isDataMode"
        class="act4-info-card__feedback"
        :class="[
          `act4-info-card__feedback--${feedbackDisplay.tone}`,
          { 'act4-info-card__feedback--empty': feedbackDisplay.isEmpty },
        ]"
        :aria-label="t('story.acts.act4.infoCard.aria.feedback')"
        :aria-hidden="feedbackDisplay.isEmpty ? 'true' : undefined"
      >
        {{ feedbackDisplay.text }}
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Act4InfoCardModel, Act4InfoTone } from "~/types/act4";

const props = defineProps<{
  model: Act4InfoCardModel;
}>();
const { t } = useI18n();

const isDataMode = computed(
  () => props.model.mode === "tutorial" || props.model.mode === "story",
);

const feedbackDisplay = computed<{
  text: string;
  tone: Act4InfoTone;
  isEmpty: boolean;
}>(() => {
  if (props.model.feedback) {
    return {
      text: props.model.feedback.text,
      tone: props.model.feedback.tone,
      isEmpty: false,
    };
  }

  if (props.model.subtitle) {
    return {
      text: props.model.subtitle,
      tone: "neutral",
      isEmpty: false,
    };
  }

  return {
    text: "",
    tone: "neutral",
    isEmpty: true,
  };
});
</script>

<style>
.act4-info-card {
  display: grid;
  grid-template-rows: minmax(0, 1fr);
  height: 100%;
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
  overflow: hidden;
  padding: clamp(22px, 2.2vw, 42px) clamp(24px, 2.45vw, 48px);
  border: 1px solid var(--act4-color-border);
  border-radius: 18px;
  background: var(--act4-color-card);
  color: var(--act4-color-text-strong);
  box-shadow: var(--act4-shadow-panel);
}

.act4-info-card > * {
  grid-area: 1 / 1;
}

.act4-info-card__data-content {
  display: grid;
  grid-template-rows: auto auto minmax(132px, 0.55fr);
  align-content: start;
  gap: clamp(20px, 2.2dvh, 34px);
  min-width: 0;
  min-height: 0;
}

.act4-info-card__focus,
.act4-info-card__climate,
.act4-info-card__narration,
.act4-info-card__period-transition,
.act4-info-card__completion {
  min-width: 0;
}

.act4-info-card__season,
.act4-info-card__movement,
.act4-info-card__period,
.act4-info-card__period-context,
.act4-info-card__temperature,
.act4-info-card__narration-text,
.act4-info-card__feedback,
.act4-info-card__transition-label,
.act4-info-card__transition-periods,
.act4-info-card__completion-title,
.act4-info-card__completion-subtitle {
  margin: 0;
}

.act4-info-card__completion {
  display: grid;
  place-items: center;
  align-content: center;
  gap: clamp(16px, 2.5dvh, 28px);
  height: 100%;
  text-align: center;
}

.act4-info-card__completion-title {
  max-width: 10ch;
  color: var(--act4-color-text-strong);
  font-size: clamp(4rem, 6.6vw, 9rem);
  font-weight: 950;
  letter-spacing: 0;
  line-height: 0.88;
}

.act4-info-card__completion-subtitle {
  max-width: 28ch;
  color: var(--act4-color-text-soft);
  font-size: clamp(1.1rem, 1.3vw, 1.8rem);
  font-weight: 760;
  line-height: 1.16;
}

.act4-info-card__focus {
  display: grid;
  gap: clamp(10px, 1.2dvh, 18px);
}

.act4-info-card__season {
  overflow-wrap: anywhere;
  color: var(--act4-color-text-strong);
  font-size: clamp(3rem, 4.7vw, 6.25rem);
  font-weight: 900;
  letter-spacing: 0;
  line-height: 0.92;
  text-transform: uppercase;
}

.act4-info-card__movement {
  color: var(--act4-color-text-strong);
  font-size: clamp(6.3rem, 8vw, 10rem);
  font-weight: 900;
  letter-spacing: 0;
  line-height: 0.78;
}

.act4-info-card__climate {
  display: grid;
  gap: clamp(8px, 1dvh, 14px);
  padding-top: clamp(8px, 1dvh, 14px);
  border-top: 1px solid var(--act4-color-border);
}

.act4-info-card__period {
  color: var(--act4-color-text-strong);
  font-size: clamp(2.35rem, 3vw, 4.1rem);
  font-weight: 900;
  letter-spacing: 0;
  line-height: 0.94;
}

.act4-info-card__period-context {
  color: var(--act4-color-text-muted);
  font-size: clamp(1rem, 1.05vw, 1.35rem);
  font-weight: 820;
  letter-spacing: 0;
  line-height: 1.1;
  text-transform: uppercase;
}

.act4-info-card__temperature {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: clamp(8px, 1vw, 14px);
  color: var(--act4-color-text-soft);
  font-size: clamp(1.02rem, 1.08vw, 1.34rem);
  font-weight: 780;
  line-height: 1.15;
}

.act4-info-card__temperature strong {
  color: var(--act4-color-temperature-difference);
  font-weight: 900;
}

.act4-info-card__temperature-value {
  display: inline-flex;
  align-items: baseline;
  gap: clamp(7px, 0.8vw, 12px);
  color: var(--act4-color-temperature-difference);
  font-size: clamp(2.25rem, 3vw, 4rem);
  font-weight: 900;
  line-height: 0.95;
  white-space: nowrap;
}

.act4-info-card__temperature-value strong {
  color: inherit;
}

.act4-info-card__temperature-baseline,
.act4-info-card__temperature-context {
  color: var(--act4-color-text-muted);
  font-size: clamp(1.02rem, 1.12vw, 1.45rem);
  font-weight: 820;
  line-height: 1.12;
  white-space: nowrap;
}

.act4-info-card__narration {
  display: grid;
  place-items: center;
  min-width: 0;
  min-height: 0;
  height: 100%;
  text-align: center;
}

.act4-info-card__narration-text {
  max-width: 15ch;
  color: var(--act4-color-text-strong);
  font-size: clamp(2.35rem, 3.2vw, 4.45rem);
  font-weight: 900;
  letter-spacing: 0;
  line-height: 1.02;
  overflow-wrap: anywhere;
  white-space: normal;
}

.act4-info-card__feedback {
  justify-self: stretch;
  align-self: stretch;
  display: grid;
  place-items: center;
  min-height: clamp(132px, 17dvh, 210px);
  overflow: hidden;
  padding: clamp(16px, 1.7vw, 28px);
  border: 1px solid var(--act4-feedback-neutral-border);
  border-radius: 14px;
  background: var(--act4-feedback-neutral-background);
  color: var(--act4-feedback-neutral-text);
  font-size: clamp(1.7rem, 2.2vw, 3rem);
  font-weight: 900;
  letter-spacing: 0;
  line-height: 1.04;
  text-align: center;
  overflow-wrap: anywhere;
  white-space: normal;
}

.act4-info-card__feedback--empty {
  visibility: hidden;
}

.act4-info-card__feedback--excellent,
.act4-info-card__feedback--success {
  border-color: var(--act4-feedback-success-border);
  background: var(--act4-feedback-success-background);
  color: var(--act4-feedback-success-text);
}

.act4-info-card__feedback--error,
.act4-info-card__feedback--warning {
  border-color: var(--act4-feedback-warning-border);
  background: var(--act4-feedback-warning-background);
  color: var(--act4-feedback-warning-text);
}

.act4-info-card--periodTransition {
  place-items: center;
  padding: clamp(28px, 3vw, 54px);
  text-align: center;
}

.act4-info-card--completed {
  padding: clamp(28px, 3.6vw, 64px);
}

.act4-info-card__period-transition {
  display: grid;
  place-items: center;
  align-content: center;
  gap: clamp(28px, 4dvh, 56px);
  width: 100%;
  height: 100%;
  animation: act4-period-transition-in 420ms ease-out both;
}

.act4-info-card__transition-label {
  color: var(--act4-color-text-muted);
  font-size: clamp(1rem, 1.1vw, 1.28rem);
  font-weight: 850;
  letter-spacing: 0;
  line-height: 1;
  text-transform: uppercase;
}

.act4-info-card__transition-periods {
  display: grid;
  justify-items: center;
  gap: clamp(18px, 2.4dvh, 30px);
  width: 100%;
}

.act4-info-card__transition-period {
  color: var(--act4-color-text-muted);
  font-size: clamp(3.6rem, 5.9vw, 8rem);
  font-weight: 900;
  letter-spacing: 0;
  line-height: 0.95;
}

.act4-info-card__transition-period--next {
  color: var(--act4-color-text-strong);
}

.act4-info-card__transition-arrow {
  color: var(--act4-transition-arrow);
  font-size: clamp(2.4rem, 3.4vw, 4.4rem);
  font-weight: 800;
  line-height: 1;
}

@keyframes act4-period-transition-in {
  from {
    opacity: 0;
    transform: translateY(14px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 1180px) {
  .act4-info-card {
    padding: 20px 22px;
    gap: 12px;
  }

  .act4-info-card__movement {
    font-size: clamp(4rem, 8.2vw, 7.2rem);
  }

  .act4-info-card__period {
    font-size: clamp(2rem, 4vw, 3.4rem);
  }

  .act4-info-card__temperature-value {
    font-size: clamp(2rem, 4.2vw, 3.3rem);
  }
}

@media (max-width: 860px) {
  .act4-info-card {
    padding: 16px;
    border-radius: 14px;
  }

  .act4-info-card__completion-title {
    font-size: clamp(3rem, 10vw, 5rem);
  }

  .act4-info-card__narration-text {
    font-size: clamp(1.7rem, 4.8vw, 3rem);
  }

  .act4-info-card__feedback {
    min-height: 112px;
    font-size: clamp(1.25rem, 3.2vw, 2rem);
  }
}
</style>
