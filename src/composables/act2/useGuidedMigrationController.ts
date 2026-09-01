import { computed, ref, watch, type WatchStopHandle } from "vue";
import { useGuidedAct2Narration } from "~/composables/act2/useGuidedAct2Narration";
import type { MigrationActRuntimeService } from "~/composables/migrationActs/useMigrationActRuntime";
import { useMigrationActStore } from "~/store/migrationActs/migrationAct";
import type { StoryGestureId } from "~/story/gestures";
import type {
  GuidedMigrationPhase,
  MigrationActInfoPanelModel,
  MigrationInfoPanelActionId,
  MigrationMovementBarEvaluation,
  MigrationMovementPhraseEvaluation,
  ResolvedMigrationMovement,
} from "~/types/migrationAct";
import {
  GUIDED_GESTURE_DEMONSTRATIONS,
  GUIDED_MOVEMENT_DEMONSTRATIONS,
  GUIDED_REQUIRED_SUCCESSFUL_BARS,
  GUIDED_SUMMER_DEMONSTRATIONS,
  guidedAct2Timing,
  type GuidedAct2TimingConfig,
} from "~/utils/act2/guidedConfig";
import type { GuidedNarrationId } from "~/utils/act2/guidedNarrationCatalog";
import { resolveGuidedNarrationTokens } from "~/utils/act2/guidedNarrationTokens";
import { resolveMigrationMovement } from "~/utils/migrationActs/migrationMovementSelection";
import type { StorkMigrationEvent } from "~/types/stork";
import type { NarrationResult, NarrationSpeakOptions } from "~/types/narration";
import { migrationStoryCycleDefinitions } from "~/utils/migrationStoryData";
import { getMigrationGestureFeedbackCatalogEntry } from "~/utils/migrationActs/gestureFeedback";

type ContinuousTutorialPhases = {
  context: GuidedMigrationPhase;
  demonstration: GuidedMigrationPhase;
  prompt: GuidedMigrationPhase;
  practice: GuidedMigrationPhase;
  success: GuidedMigrationPhase;
};

type GestureTutorialPhases = {
  context: GuidedMigrationPhase;
  demonstration?: GuidedMigrationPhase;
  prompt: GuidedMigrationPhase;
  practice: GuidedMigrationPhase;
  success: GuidedMigrationPhase;
};

type ContinuousPractice = {
  runId: number;
  movementId: string;
  evaluationUnit: "bar" | "phrase";
  resolve: (completed: boolean) => void;
};

const PASSIVE_POSITIVE_FEEDBACK_MIN_BARS = 2;
const PASSIVE_POSITIVE_FEEDBACK_COOLDOWN_MS = 6_000;
const PASSIVE_POSITIVE_FEEDBACK_DURATION_MS = 1_250;
const GUIDED_BLOCKING_INTERACTION_PHASES = new Set<GuidedMigrationPhase>([
  "summer-practice",
  "autumn-departure-practice",
  "autumn-migration-practice",
  "autumn-arrival-practice",
  "winter-practice",
  "spring-departure-practice",
  "spring-migration-practice",
  "spring-arrival-practice",
]);

export const isGuidedBlockingInteractionPhase = (phase: GuidedMigrationPhase) =>
  GUIDED_BLOCKING_INTERACTION_PHASES.has(phase);

export type GuidedMigrationController = ReturnType<
  typeof useGuidedMigrationController
>;

export const useGuidedMigrationController = ({
  runtime,
  enabled,
  timing = guidedAct2Timing,
  onGuidedCycleCompleted,
  instructionNarration,
  translate,
}: {
  runtime: MigrationActRuntimeService;
  enabled: boolean;
  timing?: GuidedAct2TimingConfig;
  onGuidedCycleCompleted?: () => void | Promise<void>;
  translate?: (key: string) => string;
  instructionNarration?: {
    play?: (
      cueKey: string,
      options?: { behavior?: "replace" },
    ) => Promise<NarrationResult> | NarrationResult;
    speakText?: (
      text: string,
      options?: Pick<
        NarrationSpeakOptions,
        "behavior" | "rate" | "onStart" | "onEnd"
      >,
    ) => Promise<NarrationResult> | NarrationResult;
    stop: () => void;
  };
}) => {
  const store = useMigrationActStore();
  const translateText = translate ?? ((key: string) => key);
  const processedEvaluationIds = new Set<string>();
  const processedPassiveEvaluationIds = new Set<string>();
  const passivePositiveFeedbackText = ref<string | null>(null);
  let activePractice: ContinuousPractice | null = null;
  let runId = 0;
  let disposed = false;
  let flowStarted = false;
  let passiveSuccessfulBarsSinceFeedback = 0;
  let passiveFeedbackCooldownUntilMs = 0;
  let passiveFeedbackTimer: ReturnType<typeof setTimeout> | null = null;

  const narration = useGuidedAct2Narration({
    narration: instructionNarration
      ? {
          speakText: instructionNarration.speakText,
          stop: instructionNarration.stop,
        }
      : undefined,
    getTransportMs: () => runtime.getGuidedTransportMs?.() ?? 0,
    getTokens: () =>
      resolveGuidedNarrationTokens(
        migrationStoryCycleDefinitions.find(
          (cycle) => cycle.label === store.activeCycleId,
        ),
      ),
  });

  const summerMovement = resolveMigrationMovement({
    phase: "summer_rest",
    phaseDurationMs: 0,
  });

  const isCurrentRun = (candidate: number) => !disposed && candidate === runId;

  const cancelPractice = () => {
    activePractice?.resolve(false);
    activePractice = null;
    processedEvaluationIds.clear();
  };

  const invalidateRun = () => {
    runId++;
    cancelPractice();
    resetPassiveFeedbackState();
    return runId;
  };

  const setPhase = (
    phase: GuidedMigrationPhase,
    status: typeof store.guided.status,
    patch: Partial<typeof store.guided> = {},
  ) => {
    narration.enterPhase(phase);
    if (!isPassiveContinuousPhase(phase)) clearPassivePositiveFeedback();
    store.setGuidedState({ phase, status, ...patch });
  };

  const cue = (id: GuidedNarrationId, eventId?: string) =>
    narration.present(id, eventId);

  const waitForSuccessBar = async (currentRunId: number) => {
    if (!isCurrentRun(currentRunId)) return false;
    await runtime.waitForGuidedBars?.(1);
    return isCurrentRun(currentRunId);
  };

  const waitForGestureSuccessWindow = async (currentRunId: number) => {
    if (!isCurrentRun(currentRunId)) return false;
    await (runtime.waitForGuidedBeats?.(2) ?? runtime.waitForGuidedBars?.(1));
    return isCurrentRun(currentRunId);
  };

  const clearPassivePositiveFeedback = () => {
    if (passiveFeedbackTimer) {
      clearTimeout(passiveFeedbackTimer);
      passiveFeedbackTimer = null;
    }
    passivePositiveFeedbackText.value = null;
  };

  const resetPassiveFeedbackState = () => {
    processedPassiveEvaluationIds.clear();
    passiveSuccessfulBarsSinceFeedback = 0;
    passiveFeedbackCooldownUntilMs = 0;
    clearPassivePositiveFeedback();
  };

  const isPassiveContinuousPhase = (phase: GuidedMigrationPhase) =>
    phase.startsWith("summer-") ||
    phase.startsWith("autumn-migration-") ||
    phase.startsWith("winter-") ||
    phase.startsWith("spring-migration-");

  const showPassivePositiveFeedback = () => {
    const goodText = translateText("story.acts.act4.movementText.good");
    passivePositiveFeedbackText.value =
      goodText === "story.acts.act4.movementText.good" ? "Good!" : goodText;
    if (passiveFeedbackTimer) clearTimeout(passiveFeedbackTimer);
    passiveFeedbackTimer = setTimeout(() => {
      passivePositiveFeedbackText.value = null;
      passiveFeedbackTimer = null;
    }, PASSIVE_POSITIVE_FEEDBACK_DURATION_MS);
  };

  const handlePassiveEvaluation = (
    evaluation: MigrationMovementBarEvaluation,
  ) => {
    if (
      !isPassiveContinuousPhase(store.guided.phase) ||
      !store.guided.activeMovementId ||
      evaluation.movementId !== store.guided.activeMovementId ||
      evaluation.status !== "success" ||
      processedPassiveEvaluationIds.has(evaluation.evaluationId)
    ) {
      return;
    }

    processedPassiveEvaluationIds.add(evaluation.evaluationId);
    passiveSuccessfulBarsSinceFeedback++;

    const now = runtime.getGuidedTransportMs?.() ?? 0;
    if (
      passiveSuccessfulBarsSinceFeedback < PASSIVE_POSITIVE_FEEDBACK_MIN_BARS ||
      now < passiveFeedbackCooldownUntilMs
    ) {
      return;
    }

    passiveSuccessfulBarsSinceFeedback = 0;
    passiveFeedbackCooldownUntilMs =
      now + PASSIVE_POSITIVE_FEEDBACK_COOLDOWN_MS;
    showPassivePositiveFeedback();
  };

  const getContinuousCuePrefix = (phase: GuidedMigrationPhase) =>
    phase.startsWith("summer-")
      ? "summer"
      : phase.startsWith("autumn-migration-")
        ? "autumnMigration"
        : phase.startsWith("winter-")
          ? "winter"
          : "springMigration";

  const waitForContinuousPractice = (
    movementId: string,
    evaluationUnit: ContinuousPractice["evaluationUnit"],
    currentRunId: number,
  ) =>
    new Promise<boolean>((resolve) => {
      activePractice = {
        movementId,
        evaluationUnit,
        runId: currentRunId,
        resolve,
      };
    });

  const useGuidedRecognitionProfile = (
    movement: ResolvedMigrationMovement,
  ): ResolvedMigrationMovement =>
    movement.movementType === "migration"
      ? { ...movement, recognitionProfile: "migration-guided" }
      : movement;

  const runContinuousMovementTutorial = async ({
    movement,
    phases,
    currentRunId,
    initialPhase,
  }: {
    movement: ResolvedMigrationMovement;
    phases: ContinuousTutorialPhases;
    currentRunId: number;
    initialPhase?: GuidedMigrationPhase;
  }) => {
    const guidedMovement = useGuidedRecognitionProfile(movement);
    const cuePrefix = getContinuousCuePrefix(phases.context);
    const demonstrationCount =
      cuePrefix === "summer"
        ? GUIDED_SUMMER_DEMONSTRATIONS
        : GUIDED_MOVEMENT_DEMONSTRATIONS;
    const initialState = {
      activeMovementId: guidedMovement.movementId,
      activeGestureId: null,
      successfulBars: 0,
      requiredSuccessfulBars: GUIDED_REQUIRED_SUCCESSFUL_BARS,
      demonstrationIndex: 0,
      demonstrationCount,
    };
    if (initialPhase) setPhase(initialPhase, "context", initialState);
    processedEvaluationIds.clear();
    const practiceCompleted = waitForContinuousPractice(
      guidedMovement.movementId,
      movement.movementType === "migration" ? "phrase" : "bar",
      currentRunId,
    );
    await runtime.playTutorialDemonstration(
      guidedMovement,
      demonstrationCount,
      (index) => {
        if (isCurrentRun(currentRunId)) {
          if (index === demonstrationCount) {
            setPhase(phases.prompt, "prompt", {
              demonstrationIndex: index,
            });
            cue(
              `act2.${cuePrefix}.handover` as GuidedNarrationId,
              `${currentRunId}:${cuePrefix}:handover`,
            );
          } else if (cuePrefix === "summer") {
            if (index === 1) {
              setPhase("journey-introduction", "context", {
                ...initialState,
                demonstrationIndex: index,
              });
              cue(
                "act2.introduction.annualJourney",
                `${currentRunId}:summer:introduction`,
              );
            } else {
              setPhase(phases.demonstration, "demonstrating", {
                demonstrationIndex: index,
              });
              cue(
                index === 2
                  ? "act2.introduction.summerBreeding"
                  : "act2.summer.instruction",
                `${currentRunId}:summer:${index === 2 ? "breeding" : "instruction"}`,
              );
            }
          } else if (index === 2) {
            setPhase(phases.demonstration, "demonstrating", {
              demonstrationIndex: index,
            });
            cue(
              `act2.${cuePrefix}.instruction` as GuidedNarrationId,
              `${currentRunId}:${cuePrefix}:instruction`,
            );
          } else {
            setPhase(phases.context, "context", {
              ...initialState,
              demonstrationIndex: index,
            });
            cue(
              `act2.${cuePrefix}.context` as GuidedNarrationId,
              `${currentRunId}:${cuePrefix}:context`,
            );
          }
        }
      },
      { handoverToPractice: true },
    );
    if (!isCurrentRun(currentRunId)) return false;
    setPhase(phases.practice, "practicing", {
      successfulBars: 0,
      demonstrationIndex: demonstrationCount,
    });
    cue(
      `act2.${cuePrefix}.progress` as GuidedNarrationId,
      `${currentRunId}:${cuePrefix}:progress`,
    );
    if (!(await practiceCompleted) || !isCurrentRun(currentRunId)) return false;

    runtime.continueTutorialMovement();
    store.markGuidedMovementLearned(movement.movementId);
    setPhase(phases.success, "success");
    cue(
      `act2.${cuePrefix}.success` as GuidedNarrationId,
      `${currentRunId}:${cuePrefix}:success`,
    );
    return await waitForSuccessBar(currentRunId);
  };

  const markGuidedEventCompleted = (eventType: StorkMigrationEvent) => {
    const event = store.events.find((item) => item.eventType === eventType);
    if (event) store.setEventStatus(event.id, "completed");
  };

  const forceCompleteGuidedStep = () => {
    store.markGuidedPhaseFacilitatorCompleted(store.guided.phase);

    if (activePractice) {
      const practice = activePractice;
      activePractice = null;
      store.setGuidedState({
        successfulBars: store.guided.requiredSuccessfulBars,
      });
      runtime.forceCompleteGuidedRecognition();
      practice.resolve(true);
      console.info("[GuidedAct2] Facilitator completed movement practice.", {
        phase: store.guided.phase,
        movementId: practice.movementId,
      });
      return;
    }

    if (runtime.gestures.store.isActive) {
      runtime.forceCompleteGuidedRecognition();
      console.info("[GuidedAct2] Facilitator completed gesture practice.", {
        phase: store.guided.phase,
        gestureId: runtime.gestures.store.activeGestureId,
      });
    }
  };

  const canSkipCurrentBlockingInteraction = computed(
    () =>
      enabled &&
      !disposed &&
      store.guided.status === "practicing" &&
      isGuidedBlockingInteractionPhase(store.guided.phase) &&
      Boolean(activePractice || runtime.gestures.store.isActive),
  );

  const skipCurrentBlockingInteraction = () => {
    if (!canSkipCurrentBlockingInteraction.value) return false;

    forceCompleteGuidedStep();
    return true;
  };

  const runGestureTutorial = async ({
    gestureId,
    eventType,
    phases,
    demonstrate,
    leadInMovement,
    currentRunId,
  }: {
    gestureId: StoryGestureId;
    eventType: StorkMigrationEvent;
    phases: GestureTutorialPhases;
    demonstrate: boolean;
    leadInMovement: ResolvedMigrationMovement;
    currentRunId: number;
  }) => {
    const isSpring = phases.context.startsWith("spring-");
    const gesturePrefix = isSpring
      ? gestureId === "departure"
        ? "springDeparture"
        : "springArrival"
      : gestureId;
    setPhase(phases.context, "context", {
      activeMovementId: leadInMovement.movementId,
      activeGestureId: gestureId,
      successfulBars: 0,
      demonstrationIndex: 0,
      demonstrationCount: demonstrate ? GUIDED_GESTURE_DEMONSTRATIONS : 1,
    });

    if (demonstrate && phases.demonstration) {
      setPhase(phases.demonstration, "demonstrating", {
        demonstrationIndex: 1,
      });
      const result = await runtime.playGuidedGesturePreparation({
        gestureId,
        demonstrationBars: GUIDED_GESTURE_DEMONSTRATIONS,
        handoverStartBarOffsetMs: timing.gestureHandoverStartBarOffsetMs,
        onPreparationBar: (index) => {
          if (isCurrentRun(currentRunId)) {
            store.setGuidedState({ demonstrationIndex: index });
            cue(
              `act2.${gesturePrefix}.${index === 1 ? "context" : "instruction"}` as GuidedNarrationId,
              `${currentRunId}:${gesturePrefix}:preparation:${index}`,
            );
          }
        },
        onHandoverStart: () => {
          if (!isCurrentRun(currentRunId)) return;
          setPhase(phases.prompt, "prompt", {
            demonstrationIndex: GUIDED_GESTURE_DEMONSTRATIONS + 1,
          });
          cue(
            `act2.${gesturePrefix}.handover` as GuidedNarrationId,
            `${currentRunId}:${gesturePrefix}:handover`,
          );
        },
        onAttemptStart: () => {
          if (isCurrentRun(currentRunId)) {
            setPhase(phases.practice, "practicing", {
              demonstrationIndex: GUIDED_GESTURE_DEMONSTRATIONS + 1,
            });
          }
        },
      });
      if (result !== "completed" || !isCurrentRun(currentRunId)) return false;
      markGuidedEventCompleted(eventType);
      store.markGuidedMovementLearned(`${gestureId}-gesture`);
      setPhase(phases.success, "success");
      cue(
        `act2.${gesturePrefix}.success` as GuidedNarrationId,
        `${currentRunId}:${gesturePrefix}:success`,
      );
      return await waitForGestureSuccessWindow(currentRunId);
    }

    const result = await runtime.startGuidedGesturePractice(gestureId, {
      handoverStartBarOffsetMs: timing.gestureHandoverStartBarOffsetMs,
      onHandoverStart: () => {
        if (!isCurrentRun(currentRunId)) return;
        setPhase(phases.prompt, "prompt");
        cue(
          `act2.${gesturePrefix}.handover` as GuidedNarrationId,
          `${currentRunId}:${gesturePrefix}:handover`,
        );
      },
      onAttemptStart: () => {
        if (isCurrentRun(currentRunId)) {
          setPhase(phases.practice, "practicing");
        }
      },
    });
    if (result !== "completed" || !isCurrentRun(currentRunId)) return false;

    markGuidedEventCompleted(eventType);
    store.markGuidedMovementLearned(`${gestureId}-gesture`);
    setPhase(phases.success, "success");
    cue(
      `act2.${gesturePrefix}.success` as GuidedNarrationId,
      `${currentRunId}:${gesturePrefix}:success`,
    );
    return await waitForGestureSuccessWindow(currentRunId);
  };

  const getEventElapsedMs = (eventType: StorkMigrationEvent) => {
    const event = store.events.find((item) => item.eventType === eventType);
    if (!event) throw new Error(`Missing guided event ${eventType}.`);
    return event.boundaryTimeMs;
  };

  const runStoryTransition = async ({
    phase,
    eventType,
    durationMs,
    movement,
    cues,
    currentRunId,
  }: {
    phase: GuidedMigrationPhase;
    eventType: StorkMigrationEvent;
    durationMs: number;
    movement: ResolvedMigrationMovement;
    cues: readonly GuidedNarrationId[];
    currentRunId: number;
  }) => {
    setPhase(phase, "transition", {
      activeMovementId: movement.movementId,
      activeGestureId: null,
    });
    await runtime.playGuidedStoryTransition({
      targetElapsedMs: getEventElapsedMs(eventType),
      durationMs,
      movement,
      onBar: (index) => {
        const narrationId = cues[index];
        if (narrationId && isCurrentRun(currentRunId)) {
          cue(narrationId, `${currentRunId}:${phase}:bar:${index}`);
        }
      },
    });
    return isCurrentRun(currentRunId);
  };

  const requireCurrentPhaseMovement = () => {
    const movement = runtime.resolveCurrentPhaseMovement();
    if (!movement) throw new Error("Guided phase has no resolved movement.");
    return movement;
  };

  const runGuidedFlow = async (currentRunId: number) => {
    try {
      await runtime.enterGuidedInterlude(summerMovement);
      if (!isCurrentRun(currentRunId)) return;

      if (
        !(await runContinuousMovementTutorial({
          movement: summerMovement,
          phases: {
            context: "summer-context",
            demonstration: "summer-demonstration",
            prompt: "summer-practice-prompt",
            practice: "summer-practice",
            success: "summer-success",
          },
          currentRunId,
          initialPhase: "journey-introduction",
        }))
      )
        return;

      if (
        !(await runStoryTransition({
          phase: "summer-story-transition",
          eventType: "autumn_departure",
          durationMs: timing.storyTransitionMs.summerToDeparture,
          movement: summerMovement,
          cues: [
            "act2.summer.story.breeding",
            "act2.summer.story.embodiedMeaning",
            "act2.summer.story.departureApproaches",
          ],
          currentRunId,
        }))
      )
        return;

      const autumnMovement = requireCurrentPhaseMovement();
      const autumnPreload = runtime.preloadTutorialMovement(
        useGuidedRecognitionProfile(autumnMovement),
      );

      if (
        !(await runGestureTutorial({
          gestureId: "departure",
          eventType: "autumn_departure",
          demonstrate: true,
          leadInMovement: summerMovement,
          phases: {
            context: "autumn-departure-context",
            demonstration: "autumn-departure-demonstration",
            prompt: "autumn-departure-practice-prompt",
            practice: "autumn-departure-practice",
            success: "autumn-departure-success",
          },
          currentRunId,
        }))
      )
        return;
      if (!(await autumnPreload) || !isCurrentRun(currentRunId)) return;

      if (
        !(await runContinuousMovementTutorial({
          movement: autumnMovement,
          phases: {
            context: "autumn-migration-context",
            demonstration: "autumn-migration-demonstration",
            prompt: "autumn-migration-practice-prompt",
            practice: "autumn-migration-practice",
            success: "autumn-migration-success",
          },
          currentRunId,
        }))
      )
        return;

      if (
        !(await runStoryTransition({
          phase: "autumn-migration-story",
          eventType: "autumn_arrival",
          durationMs: timing.storyTransitionMs.autumnMigration,
          movement: autumnMovement,
          cues: [
            "act2.autumnMigration.story.mapAndBody",
            "act2.autumnMigration.story.route",
            "act2.autumnMigration.story.arrivalApproaches",
          ],
          currentRunId,
        }))
      )
        return;

      const winterMovement = requireCurrentPhaseMovement();
      const winterPreload = runtime.preloadTutorialMovement(winterMovement);

      if (
        !(await runGestureTutorial({
          gestureId: "arrival",
          eventType: "autumn_arrival",
          demonstrate: true,
          leadInMovement: autumnMovement,
          phases: {
            context: "autumn-arrival-context",
            demonstration: "autumn-arrival-demonstration",
            prompt: "autumn-arrival-practice-prompt",
            practice: "autumn-arrival-practice",
            success: "autumn-arrival-success",
          },
          currentRunId,
        }))
      )
        return;
      if (!(await winterPreload) || !isCurrentRun(currentRunId)) return;

      if (
        !(await runContinuousMovementTutorial({
          movement: winterMovement,
          phases: {
            context: "winter-context",
            demonstration: "winter-demonstration",
            prompt: "winter-practice-prompt",
            practice: "winter-practice",
            success: "winter-success",
          },
          currentRunId,
        }))
      )
        return;

      if (
        !(await runStoryTransition({
          phase: "winter-story-transition",
          eventType: "spring_departure",
          durationMs: timing.storyTransitionMs.winterToDeparture,
          movement: winterMovement,
          cues: [
            "act2.winter.story.behavior",
            "act2.winter.story.conditions",
            "act2.winter.story.returnApproaches",
          ],
          currentRunId,
        }))
      )
        return;

      const springMovement = requireCurrentPhaseMovement();
      const springPreload = runtime.preloadTutorialMovement(
        useGuidedRecognitionProfile(springMovement),
      );

      if (
        !(await runGestureTutorial({
          gestureId: "departure",
          eventType: "spring_departure",
          demonstrate: false,
          leadInMovement: winterMovement,
          phases: {
            context: "spring-departure-context",
            prompt: "spring-departure-practice-prompt",
            practice: "spring-departure-practice",
            success: "spring-departure-success",
          },
          currentRunId,
        }))
      )
        return;
      if (!(await springPreload) || !isCurrentRun(currentRunId)) return;

      if (
        !(await runContinuousMovementTutorial({
          movement: springMovement,
          phases: {
            context: "spring-migration-context",
            demonstration: "spring-migration-demonstration",
            prompt: "spring-migration-practice-prompt",
            practice: "spring-migration-practice",
            success: "spring-migration-success",
          },
          currentRunId,
        }))
      )
        return;

      await runtime.preloadTutorialMovement(summerMovement);
      if (!isCurrentRun(currentRunId)) return;

      if (
        !(await runStoryTransition({
          phase: "spring-migration-story",
          eventType: "spring_arrival",
          durationMs: timing.storyTransitionMs.springMigration,
          movement: springMovement,
          cues: [
            "act2.springMigration.story.route",
            "act2.springMigration.story.embodiedMeaning",
            "act2.springMigration.story.arrivalApproaches",
          ],
          currentRunId,
        }))
      )
        return;

      if (
        !(await runGestureTutorial({
          gestureId: "arrival",
          eventType: "spring_arrival",
          demonstrate: false,
          leadInMovement: springMovement,
          phases: {
            context: "spring-arrival-context",
            prompt: "spring-arrival-practice-prompt",
            practice: "spring-arrival-practice",
            success: "spring-arrival-success",
          },
          currentRunId,
        }))
      )
        return;

      if (!(await runtime.startTutorialStoryMovement(summerMovement))) return;
      if (!isCurrentRun(currentRunId)) return;
      setPhase("cycle-complete", "completed", {
        activeMovementId: summerMovement.movementId,
        activeGestureId: null,
      });
      await runtime.playGuidedStoryTransition({
        targetElapsedMs: store.currentElapsedMs,
        durationMs: 8_000,
        movement: summerMovement,
        onBar: (index) => {
          const id = [
            "act2.completion.journeyComplete",
            "act2.completion.movementSummary",
          ][index] as GuidedNarrationId | undefined;
          if (id && isCurrentRun(currentRunId)) {
            cue(id, `${currentRunId}:completion:bar:${index}`);
          }
        },
      });
      if (!isCurrentRun(currentRunId)) return;
      cue("act2.completion.title", `${currentRunId}:completion:title`);
      if (!(await waitForSuccessBar(currentRunId))) return;
      runtime.completeGuidedInterlude?.();
      store.markCycleCompleted(store.activeCycleRun?.id ?? "guided-cycle");
      store.setGuidedState({
        completionCount: store.guided.completionCount + 1,
      });
      await onGuidedCycleCompleted?.();
    } catch (error) {
      if (!isCurrentRun(currentRunId)) return;
      store.setError(
        error instanceof Error ? error.message : "Guided migration failed.",
      );
    }
  };

  const startGuidedJourney = () => {
    if (!enabled || disposed || flowStarted || store.guided.phase !== "idle") {
      return;
    }
    flowStarted = true;
    const currentRunId = invalidateRun();
    void runGuidedFlow(currentRunId);
  };

  const initialize = () => {
    if (!enabled) return;
    disposed = false;
    flowStarted = false;
    invalidateRun();
    narration.reset("initialize");
    store.resetGuidedState();
  };

  const resetAct = async () => {
    invalidateRun();
    narration.reset("act-reset");
    flowStarted = false;
    runtime.cancelGuidedInterlude();
    await runtime.reset();
    if (!disposed) store.resetGuidedState();
  };

  const handleAction = (actionId: MigrationInfoPanelActionId) => {
    if (actionId === "startGuidedJourney") startGuidedJourney();
    if (actionId === "forceCompleteGuidedStep") forceCompleteGuidedStep();
  };

  const handleContinuousPracticeEvaluation = (
    evaluation:
      MigrationMovementBarEvaluation | MigrationMovementPhraseEvaluation,
    expectedUnit: ContinuousPractice["evaluationUnit"],
  ) => {
    const practice = activePractice;
    if (!enabled || disposed || !practice) return;
    if (practice.evaluationUnit !== expectedUnit) return;

    if (
      !isCurrentRun(practice.runId) ||
      evaluation.movementId !== practice.movementId ||
      processedEvaluationIds.has(evaluation.evaluationId)
    ) {
      return;
    }

    processedEvaluationIds.add(evaluation.evaluationId);
    if (evaluation.status !== "success") {
      const prefix = getContinuousCuePrefix(store.guided.phase);
      if (evaluation.status === "not_evaluable") {
        cue(
          "act2.feedback.bodyNotVisible",
          `${evaluation.evaluationId}:tracking`,
        );
      } else {
        const noMovement = evaluation.beatResults.every(
          (beat) =>
            beat.detectedSide === null &&
            (beat.metrics.activeFootDelta === null ||
              Math.abs(beat.metrics.activeFootDelta) < 0.01),
        );
        cue(
          `act2.${prefix}.failure.${noMovement ? "noMovement" : "incomplete"}` as GuidedNarrationId,
          `${evaluation.evaluationId}:movement-failure`,
        );
      }
      return;
    }

    const successfulBars = Math.min(
      store.guided.successfulBars + 1,
      store.guided.requiredSuccessfulBars,
    );
    store.setGuidedState({ successfulBars });
    if (successfulBars < store.guided.requiredSuccessfulBars) return;

    activePractice = null;
    practice.resolve(true);
  };

  const stopEvaluationWatch: WatchStopHandle = watch(
    runtime.movementRecognition.lastBarEvaluation,
    (evaluation) => {
      const practice = activePractice;
      if (!enabled || disposed || !evaluation) {
        return;
      }

      if (!practice) {
        handlePassiveEvaluation(evaluation);
        return;
      }

      handleContinuousPracticeEvaluation(evaluation, "bar");
    },
  );

  const stopPhraseEvaluationWatch: WatchStopHandle = watch(
    runtime.movementRecognition.lastPhraseEvaluation,
    (evaluation) => {
      if (!enabled || disposed || !evaluation) return;

      handleContinuousPracticeEvaluation(evaluation, "phrase");
    },
  );

  const stopGestureEvaluationWatch: WatchStopHandle = watch(
    () => runtime.gestures.store.latestEvaluationResult,
    (result) => {
      if (!enabled || disposed || !result || result.status === "success")
        return;
      const feedback = getMigrationGestureFeedbackCatalogEntry(
        result.primaryFeedbackCode,
      );
      if (!feedback) return;
      narration.presentExternal({
        id: `act2.gestureFeedback.${result.primaryFeedbackCode}`,
        title: translateText(feedback.titleKey),
        text: translateText(feedback.textKey),
        priority:
          result.primaryFeedbackCode === "CHECKPOINT_NOT_EVALUABLE" ? 100 : 70,
        eventId: result.id,
      });
    },
  );

  const panelModel = computed<MigrationActInfoPanelModel>(() => {
    const state = store.guided;
    const content = narration.panelContent.value;
    const isPractice = state.phase.endsWith("-practice");
    const isContinuousPractice =
      isPractice && Boolean(state.activeMovementId) && !state.activeGestureId;
    const isDemonstration = state.phase.endsWith("-demonstration");
    const isSuccess = state.phase.endsWith("-success");
    const isTransition =
      state.phase.includes("story-transition") ||
      state.phase.endsWith("-story");
    const isCompleted = state.phase === "cycle-complete";

    const actions: MigrationActInfoPanelModel["actions"] =
      state.phase === "idle"
        ? [
            {
              id: "startGuidedJourney",
              label: "Start guided journey",
              primary: true,
            },
          ]
        : import.meta.dev &&
            state.phase !== "cycle-complete" &&
            state.phase !== "journey-introduction"
          ? [
              {
                id: "forceCompleteGuidedStep",
                label: "Force complete current guided step",
              },
            ]
          : [];

    return {
      mode: isCompleted
        ? "completed"
        : isTransition
          ? "cycleTransition"
          : isSuccess
            ? "movementFeedback"
            : state.activeGestureId
              ? "gestureInstruction"
              : "phaseInstruction",
      title: content.title,
      instruction: content.text,
      status: isDemonstration
        ? `Demonstration ${state.demonstrationIndex} of ${state.demonstrationCount}`
        : isContinuousPractice
          ? `${state.successfulBars} of ${state.requiredSuccessfulBars}`
          : undefined,
      feedbackText: passivePositiveFeedbackText.value ?? undefined,
      tone:
        isSuccess || isCompleted || passivePositiveFeedbackText.value
          ? "success"
          : "neutral",
      progress: isContinuousPractice
        ? {
            current: state.successfulBars,
            total: state.requiredSuccessfulBars,
            label: `${state.successfulBars} of ${state.requiredSuccessfulBars} successful movements`,
          }
        : undefined,
      movements: [],
      actions,
    };
  });

  const dispose = () => {
    disposed = true;
    invalidateRun();
    narration.cancel("dispose");
    stopEvaluationWatch();
    stopPhraseEvaluationWatch();
    stopGestureEvaluationWatch();
    runtime.cancelGuidedInterlude();
  };

  return {
    enabled,
    state: computed(() => store.guided),
    panelModel,
    narrationDiagnostics: narration.diagnostics,
    isGuidedUiActive: computed(() => enabled),
    startGuidedJourney,
    resetAct,
    handleAction,
    canSkipCurrentBlockingInteraction,
    skipCurrentBlockingInteraction,
    pause: runtime.pause,
    resume: runtime.resume,
    initialize,
    dispose,
  };
};
