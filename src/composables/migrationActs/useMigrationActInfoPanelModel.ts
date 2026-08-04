import { computed, unref, type MaybeRef } from "vue";
import { useMigrationActStore } from "~/store/migrationActs/migrationAct";
import { useStoryGestureStore } from "~/store/storyGestureStore";
import {
  buildMigrationActInfoPanelModel,
  buildMigrationMovementList,
} from "~/utils/migrationActs/infoPanel";

export const useMigrationActInfoPanelModel = ({
  showDevActions = false,
  completed = false,
  showContinueAction = false,
}: {
  showDevActions?: MaybeRef<boolean>;
  completed?: MaybeRef<boolean>;
  showContinueAction?: MaybeRef<boolean>;
} = {}) => {
  const store = useMigrationActStore();
  const gestureStore = useStoryGestureStore();
  const { t } = useI18n();
  const translate = (
    key: string,
    params: Record<string, string | number> = {},
  ) => String(t(key, params));

  const movements = computed(() =>
    buildMigrationMovementList({
      timeline: store.timeline,
      events: store.events,
      currentElapsedMs: store.currentElapsedMs,
      activeEventId: store.activeEventId,
      translate,
    }),
  );
  const model = computed(() =>
    buildMigrationActInfoPanelModel({
      translate,
      movements: movements.value,
      playbackState: store.playbackState,
      currentPhase: store.currentPhase,
      systemError: store.error,
      gestureState: gestureStore.state,
      gesturePhase: gestureStore.gesturePhase,
      gestureId: gestureStore.activeGestureId,
      gestureAttempt: gestureStore.attemptCount,
      gestureCueText: gestureStore.feedbackText,
      gestureFeedback: gestureStore.latestEvaluationResult,
      gestureFeedbackVisible: gestureStore.isEvaluationFeedbackVisible,
      gestureCanContinue: gestureStore.canContinue,
      movementFeedbackVisible: Boolean(store.temporaryMovementFeedbackId),
      showDevActions: unref(showDevActions),
      completed: unref(completed),
      showContinueAction: unref(showContinueAction),
    }),
  );

  return { model, movements };
};
