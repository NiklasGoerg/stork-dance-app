import { computed, watch, type ComputedRef } from "vue";
import { useAutumnMovementRecognition } from "~/composables/act4/useAutumnMovementRecognition";
import { useSpringMovementRecognition } from "~/composables/act4/useSpringMovementRecognition";
import { useSummerMovementRecognition } from "~/composables/act4/useSummerMovementRecognition";
import { useWinterMovementRecognition } from "~/composables/act4/useWinterMovementRecognition";
import type {
  MovementBeatEvaluationLike,
  MovementMeasureEvaluation,
} from "~/types/movement";
import type {
  Act4FeedbackSignal,
  Act4RecognitionFrame,
  Act4RecognitionSequenceEvaluation,
  Act4SequenceTarget,
} from "~/types/act4";
import type { ClimateSeason } from "~/types/climate";
import type { AutumnValueClass } from "~/utils/movement/acts/climate/autumn/autumnMovementRecognition";
import type { SpringValue } from "~/utils/movement/acts/climate/spring/springMovementRecognition";
import type { SummerIntensity } from "~/utils/movement/acts/climate/summer/summerMovementRecognition";
import type { WinterValue } from "~/utils/movement/acts/climate/winter/winterMovementRecognition";

type Act4SeasonRecognizer = {
  sequenceEvaluation: {
    value: Act4RecognitionSequenceEvaluation | null;
  };
  currentCycleEvaluation: {
    value: MovementMeasureEvaluation<Act4BeatEvaluation, string> | null;
  };
  finalizedBeatEvaluations: {
    value: Act4BeatEvaluation[];
  };
  cycleEvaluations: {
    value: MovementMeasureEvaluation<Act4BeatEvaluation, string>[];
  };
  currentEvaluation: {
    value: Act4BeatEvaluation | null;
  };
  feedbackCode: {
    value: string | null;
  };
  debugSnapshot: {
    value: unknown;
  };
  reset: () => void;
  updateFrame: (frame: Act4RecognitionFrame) => void;
};

type Act4BeatEvaluation = MovementBeatEvaluationLike & {
  feedbackSignals?: Act4FeedbackSignal[];
};

export type Act4Recognition = ReturnType<typeof useAct4Recognition>;

const getRecognitionRules = (target: Act4SequenceTarget) => ({
  measuresPerValue: Math.max(target.rules.measuresPerStep - 1, 1),
  requiredSuccessfulMeasures: target.rules.requiredSuccessfulMeasures,
});

export const useAct4Recognition = ({
  activeTarget,
  isRecognitionSuppressed,
  autoProgressEnabled,
  onSequenceEvaluation,
}: {
  activeTarget: ComputedRef<Act4SequenceTarget | null>;
  isRecognitionSuppressed: ComputedRef<boolean>;
  autoProgressEnabled: ComputedRef<boolean>;
  onSequenceEvaluation: (
    target: Act4SequenceTarget,
    evaluation: Act4RecognitionSequenceEvaluation,
  ) => void;
}) => {
  const summer = useSummerMovementRecognition();
  const autumn = useAutumnMovementRecognition();
  const spring = useSpringMovementRecognition();
  const winter = useWinterMovementRecognition();

  const recognizers: Record<ClimateSeason, Act4SeasonRecognizer> = {
    summer,
    autumn,
    spring,
    winter,
  };

  const activeSeason = computed(() => activeTarget.value?.season ?? null);
  const activeRecognizer = computed(() =>
    activeSeason.value ? recognizers[activeSeason.value] : null,
  );
  const currentMeasureEvaluation = computed(
    () => activeRecognizer.value?.currentCycleEvaluation.value ?? null,
  );
  const cycleEvaluations = computed(
    () => activeRecognizer.value?.cycleEvaluations.value ?? [],
  );
  const currentEvaluation = computed(
    () => activeRecognizer.value?.currentEvaluation.value ?? null,
  );
  const finalizedBeatEvaluations = computed(
    () => activeRecognizer.value?.finalizedBeatEvaluations.value ?? [],
  );
  const feedbackCode = computed(
    () => activeRecognizer.value?.feedbackCode.value ?? null,
  );
  const debugSnapshots = computed(() => ({
    summer: summer.debugSnapshot.value,
    autumn: autumn.debugSnapshot.value,
    spring: spring.debugSnapshot.value,
    winter: winter.debugSnapshot.value,
  }));

  const resetAll = () => {
    summer.reset();
    autumn.reset();
    spring.reset();
    winter.reset();
  };

  const startTarget = (
    target: Act4SequenceTarget,
    options: { keepCalibration?: boolean; manual?: boolean } = {},
  ) => {
    const rules = getRecognitionRules(target);
    const movementValue = String(target.movementValue);

    if (target.season === "summer") {
      summer.start({
        intensity: movementValue as SummerIntensity,
        keepCalibration: options.keepCalibration,
        manual: options.manual,
        rules,
      });
    }

    if (target.season === "autumn") {
      autumn.start({
        valueClass: movementValue as AutumnValueClass,
        rules,
      });
    }

    if (target.season === "spring") {
      spring.start({
        value: movementValue as SpringValue,
        rules,
      });
    }

    if (target.season === "winter") {
      winter.start({
        value: movementValue as WinterValue,
        rules,
      });
    }
  };

  const updateFrame = (frame: Act4RecognitionFrame) => {
    const suppressed = isRecognitionSuppressed.value;
    const recognitionSeasonId = suppressed
      ? "act4-suppressed"
      : (activeTarget.value?.season ?? frame.seasonId);
    const recognitionFrame = {
      ...frame,
      playbackState: suppressed ? "idle" : frame.playbackState,
      seasonId: recognitionSeasonId,
      repetitionIndex: suppressed ? null : frame.repetitionIndex,
      isTransition: suppressed ? false : frame.isTransition,
      autoProgressEnabled: autoProgressEnabled.value,
    };

    summer.updateFrame(recognitionFrame);
    autumn.updateFrame(recognitionFrame);
    spring.updateFrame(recognitionFrame);
    winter.updateFrame(recognitionFrame);
  };

  const stopEvaluationWatchers = (
    Object.values(recognizers) as Act4SeasonRecognizer[]
  ).map((recognizer) =>
    watch(
      () => recognizer.sequenceEvaluation.value,
      (evaluation) => {
        const target = activeTarget.value;

        if (!target || !evaluation) return;
        if (recognizers[target.season] !== recognizer) return;

        onSequenceEvaluation(target, evaluation);
      },
    ),
  );

  const dispose = () => {
    stopEvaluationWatchers.forEach((stop) => stop());
    resetAll();
  };

  return {
    activeSeason,
    currentMeasureEvaluation,
    currentEvaluation,
    cycleEvaluations,
    finalizedBeatEvaluations,
    feedbackCode,
    debugSnapshots,
    resetAll,
    startTarget,
    updateFrame,
    dispose,
  };
};
