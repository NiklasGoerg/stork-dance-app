<template>
  <nav class="story-progress" :aria-label="t('story.aria.progress')">
    <button
      v-for="(act, index) in progressActs"
      :key="act.id"
      type="button"
      class="story-progress__item"
      :class="{
        'story-progress__item--active': activeActId === act.id,
        'story-progress__item--completed': isCompleted(index),
        'story-progress__item--line-complete': index <= completedThroughIndex,
      }"
      :aria-current="activeActId === act.id ? 'page' : undefined"
      :title="getProgressActTitle(act)"
      @click="goToAct(act.path)"
    >
      <span class="story-progress__marker" aria-hidden="true">
        <BaseIcon :path="isCompleted(index) ? mdiCheck : act.icon" :size="20" />
      </span>
      <span class="story-progress__copy">
        <span class="story-progress__label">{{
          getProgressActLabel(act)
        }}</span>
        <span class="story-progress__name">{{ getProgressActName(act) }}</span>
      </span>
    </button>
  </nav>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
  mdiBird,
  mdiCheck,
  mdiHomeOutline,
  mdiMapMarkerPath,
  mdiThermometerLines,
  mdiTransitConnectionVariant,
} from "@mdi/js";
import BaseIcon from "~/components/ui/BaseIcon.vue";
import { useStoryRuntimeStore } from "~/store/storyRuntimeStore";
import type { StoryActId } from "~/story/types";

type ProgressAct = {
  id: StoryActId;
  labelKey: string;
  nameKey: string;
  titleKey: string;
  path: string;
  icon: string;
};

const { t } = useI18n();
const route = useRoute();
const runtimeStore = useStoryRuntimeStore();

const progressActs: ProgressAct[] = [
  {
    id: "prologue",
    labelKey: "story.progress.prologue.label",
    nameKey: "story.progress.prologue.name",
    titleKey: "story.progress.prologue.title",
    path: "/story/prologue",
    icon: mdiBird,
  },
  {
    id: "act-2",
    labelKey: "story.progress.act2.label",
    nameKey: "story.progress.act2.name",
    titleKey: "story.progress.act2.title",
    path: "/story/act-2",
    icon: mdiMapMarkerPath,
  },
  {
    id: "act-3",
    labelKey: "story.progress.act3.label",
    nameKey: "story.progress.act3.name",
    titleKey: "story.progress.act3.title",
    path: "/story/act-3",
    icon: mdiTransitConnectionVariant,
  },
  {
    id: "act-4",
    labelKey: "story.progress.act4.label",
    nameKey: "story.progress.act4.name",
    titleKey: "story.progress.act4.title",
    path: "/story/act-4",
    icon: mdiThermometerLines,
  },
  {
    id: "epilogue",
    labelKey: "story.progress.epilogue.label",
    nameKey: "story.progress.epilogue.name",
    titleKey: "story.progress.epilogue.title",
    path: "/story/epilogue",
    icon: mdiHomeOutline,
  },
];

const routeActId = computed<StoryActId | null>(() => {
  const path = route.path;

  if (path.includes("/story/prologue")) return "prologue";
  if (path.includes("/story/act-2")) return "act-2";
  if (path.includes("/story/act-3")) return "act-3";
  if (path.includes("/story/act-4")) return "act-4";
  if (path.includes("/story/epilogue")) return "epilogue";

  return null;
});

const activeActId = computed<StoryActId>(
  () => routeActId.value ?? runtimeStore.currentActId ?? "act-2",
);

const activeIndex = computed(() =>
  Math.max(
    0,
    progressActs.findIndex((act) => act.id === activeActId.value),
  ),
);

const isActiveActWaitingForGate = computed(
  () =>
    runtimeStore.showContinueGate &&
    runtimeStore.currentActId === activeActId.value,
);

const completedThroughIndex = computed(() =>
  isActiveActWaitingForGate.value ? activeIndex.value + 1 : activeIndex.value,
);

const isCompleted = (index: number) =>
  index < activeIndex.value ||
  (isActiveActWaitingForGate.value && index === activeIndex.value);

const goToAct = async (path: string) => {
  await navigateTo(path);
};

const getProgressActLabel = (act: ProgressAct) => t(act.labelKey);
const getProgressActName = (act: ProgressAct) => t(act.nameKey);
const getProgressActTitle = (act: ProgressAct) => t(act.titleKey);
</script>

<style scoped>
.story-progress {
  position: absolute;
  z-index: 700;
  top: 50%;
  left: 10px;
  display: grid;
  justify-items: center;
  gap: 8px;
  width: 74px;
  padding: 0;
  transform: translateY(-50%);
}

.story-progress__item {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 4px;
  width: 100%;
  min-height: 64px;
  padding: 3px 1px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: rgba(31, 49, 39, 0.68);
  font: inherit;
  text-align: center;
  cursor: pointer;
}

.story-progress__item::before {
  content: "";
  position: absolute;
  top: -13px;
  left: 50%;
  width: 2px;
  height: 20px;
  background: rgba(31, 49, 39, 0.18);
  transform: translateX(-50%);
}

.story-progress__item:first-child::before {
  display: none;
}

.story-progress__item--line-complete::before {
  background: #2f9e5b;
}

.story-progress__item:hover,
.story-progress__item:focus-visible,
.story-progress__item--active {
  color: #20362a;
  outline: none;
}

.story-progress__item--completed {
  color: #236a3f;
}

.story-progress__marker {
  position: relative;
  z-index: 1;
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border: 1.5px solid rgba(31, 49, 39, 0.2);
  border-radius: 999px;
  background: #f8fbf7;
  color: currentColor;
}

.story-progress__item--active .story-progress__marker {
  border-color: #26382f;
  background: #26382f;
  color: #ffffff;
}

.story-progress__item--completed .story-progress__marker {
  border-color: #2f9e5b;
  background: #2f9e5b;
  color: #ffffff;
}

.story-progress__copy {
  display: grid;
  justify-items: center;
  min-width: 0;
  width: 100%;
  line-height: 1.08;
}

.story-progress__label,
.story-progress__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: normal;
}

.story-progress__label {
  font-size: 0.64rem;
  font-weight: 820;
}

.story-progress__name {
  margin-top: 2px;
  color: rgba(31, 49, 39, 0.6);
  font-size: 0.58rem;
  font-weight: 700;
}

.story-progress__item--active .story-progress__name,
.story-progress__item--completed .story-progress__name {
  color: currentColor;
}

@media (max-width: 860px) {
  .story-progress {
    top: 12px;
    left: 8px;
    width: 66px;
    gap: 6px;
    transform: none;
  }

  .story-progress__item {
    min-height: 58px;
  }

  .story-progress__marker {
    width: 34px;
    height: 34px;
  }

  .story-progress__item::before {
    top: -11px;
    height: 17px;
  }
}
</style>
