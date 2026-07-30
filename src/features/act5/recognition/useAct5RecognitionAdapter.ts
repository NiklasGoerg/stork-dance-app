import { computed, watch, type ComputedRef } from "vue";
import { useAutumnMovementRecognition } from "~/composables/useAutumnMovementRecognition";
import { useSpringMovementRecognition } from "~/composables/useSpringMovementRecognition";
import { useSummerMovementRecognition } from "~/composables/useSummerMovementRecognition";
import { useWinterMovementRecognition } from "~/composables/useWinterMovementRecognition";
import type {
  MovementBeatEvaluationLike,
  MovementMeasureEvaluation,
} from "~/composables/useBeatWindowMovementRecognition";
import type {
  Act5RecognitionSequenceEvaluation,
  Act5SequenceTarget,
} from "~/features/act5/types/act5";
import type { PoseLandmarkLike } from "~/types/pose";
import type { ClimateSeason } from "~/utils/movement/acts/climate/climateSeasonData";
import type { AutumnValueClass } from "~/utils/movement/acts/climate/autumn/autumnMovementRecognition";
import type { SpringValue } from "~/utils/movement/acts/climate/spring/springMovementRecognition";
import type { SummerIntensity } from "~/utils/movement/acts/climate/summer/summerMovementRecognition";
import type { WinterValue } from "~/utils/movement/acts/climate/winter/winterMovementRecognition";

type RecognitionPlaybackState =
  "idle" | "countdown" | "playing" | "paused" | "completed";

export type Act5RecognitionFrame = {
  landmarks: PoseLandmarkLike[] | null;
  playbackState: RecognitionPlaybackState;
  seasonId: string;
  seasonElapsedMs: number;
  repetitionIndex: number | null;
  isTransition: boolean;
  evaluationEnabled?: boolean;
  autoProgressEnabled?: boolean;
};

type Act5SeasonRecognizer = {
  sequenceEvaluation: {
    value: Act5RecognitionSequenceEvaluation | null;
  };
  currentCycleEvaluation: {
    value: MovementMeasureEvaluation<MovementBeatEvaluationLike, string> | null;
  };
  finalizedBeatEvaluations: {
    value: MovementBeatEvaluationLike[];
  };
  cycleEvaluations: {
    value: MovementMeasureEvaluation<MovementBeatEvaluationLike, string>[];
  };
  currentEvaluation: {
    value: MovementBeatEvaluationLike | null;
  };
  feedbackCode: {
    value: string | null;
  };
  debugSnapshot: {
    value: unknown;
  };
  reset: () => void;
  updateFrame: (frame: Act5RecognitionFrame) => void;
};

export type Act5RecognitionAdapter = ReturnType<
  typeof useAct5RecognitionAdapter
>;

const mirrorLandmarksHorizontally = <T extends { x: number }>(
  landmarks: T[] | null | undefined,
): T[] | null =>
  landmarks?.map((landmark) => ({
    ...landmark,
    x: 1 - landmark.x,
  })) ?? null;

const getRecognitionRules = (target: Act5SequenceTarget) => ({
  measuresPerValue: Math.max(target.rules.measuresPerStep - 1, 1),
  requiredSuccessfulMeasures: target.rules.requiredSuccessfulMeasures,
});

export const useAct5RecognitionAdapter = ({
  activeTarget,
  isRecognitionSuppressed,
  autoProgressEnabled,
  onSequenceEvaluation,
}: {
  activeTarget: ComputedRef<Act5SequenceTarget | null>;
  isRecognitionSuppressed: ComputedRef<boolean>;
  autoProgressEnabled: ComputedRef<boolean>;
  onSequenceEvaluation: (
    target: Act5SequenceTarget,
    evaluation: Act5RecognitionSequenceEvaluation,
  ) => void;
}) => {
  const summer = useSummerMovementRecognition();
  const autumn = useAutumnMovementRecognition();
  const spring = useSpringMovementRecognition();
  const winter = useWinterMovementRecognition();

  const recognizers: Record<ClimateSeason, Act5SeasonRecognizer> = {
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
    target: Act5SequenceTarget,
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

  const updateFrame = (frame: Act5RecognitionFrame) => {
    const suppressed = isRecognitionSuppressed.value;
    const recognitionSeasonId = suppressed
      ? "act5-suppressed"
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
    autumn.updateFrame({
      ...recognitionFrame,
      landmarks: mirrorLandmarksHorizontally(frame.landmarks),
    });
    spring.updateFrame(recognitionFrame);
    winter.updateFrame(recognitionFrame);
  };

  const stopEvaluationWatchers = (
    Object.values(recognizers) as Act5SeasonRecognizer[]
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
