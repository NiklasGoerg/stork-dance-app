import { computed, ref } from "vue";
import {
  useMigrationActSeasonAudio,
  type MigrationActSeasonAudioService,
} from "~/composables/migrationActs/useMigrationActSeasonAudio";
import { useMigrationActMovementSession } from "~/composables/migrationActs/useMigrationActMovementSession";
import { useMigrationActMovement } from "~/composables/migrationActs/useMigrationActMovement";
import { useMigrationActMovementRecognition } from "~/composables/migrationActs/useMigrationActMovementRecognition";
import { useNarration } from "~/composables/narration/useNarration";
import { useStoryEngine } from "~/composables/useStoryEngine";
import { useAudioStore } from "~/store/audioStore";
import { useMigrationActStore } from "~/store/migrationActs/migrationAct";
import { useStoryRuntimeStore } from "~/store/storyRuntimeStore";
import type { StoryAct } from "~/story/types";
import type { StoryGestureId } from "~/story/gestures";
import type { StoryGestureResult } from "~/store/storyGestureStore";
import type {
  AvatarPlaybackOwner,
  GuidedOwnerSwitchTrace,
  MigrationActCycleRun,
  MigrationActDebugSnapshot,
  MigrationActEvent,
  MigrationActMapFrame,
  MigrationActNarrationEventPayload,
  MigrationActNarrationCueRole,
  MigrationActNarrationSemanticEvent,
  MigrationActPauseReason,
  MigrationActSurfaceId,
  ResolvedMigrationMovement,
} from "~/types/migrationAct";
import {
  getMigrationChangeFlowArrivalCueIds,
  getMigrationChangeFlowCompletionCueIds,
  getMigrationChangeFlowCycleIntroCueId,
  getMigrationChangeFlowDepartureCueId,
  getMigrationChangeFlowIntroCueIds,
  getMigrationChangeFlowTransitionCueId,
} from "~/story/acts/migrationChangeFlow";
import type { PoseLandmarkLike } from "~/types/pose";
import {
  createMigrationActEvents,
  reconcileMigrationActEventsForSeek,
} from "~/utils/migrationActs/events";
import { resolveMigrationActCycleRuns } from "~/utils/migrationActs/config";
import { MIGRATION_RECOGNITION_THRESHOLDS } from "~/utils/migrationActs/migrationMovementConfig";
import { getMigrationMapFrame } from "~/utils/migrationActs/timeline";
import { getMigrationPlaybackAdvance } from "~/utils/migrationActs/transitions";
import {
  getMigrationMapCameraModeForEvent,
  getMigrationMapCameraModeForGesture,
  getMigrationMapCameraModeForMovement,
  getMigrationMapCameraModeForPhase,
} from "~/utils/migrationActs/mapCameraMode";
import {
  getMigrationMovementDirection,
  getMigrationMovementPhaseTiming,
  resolveMigrationMovement,
} from "~/utils/migrationActs/migrationMovementSelection";
import {
  resolveGuidedMovementSourceTime,
  resolveGuidedTransportPosition,
  resolveNextGuidedBarBoundary,
  resolvePreviousGuidedBarBoundary,
} from "~/utils/act2/guidedTiming";
import {
  buildPreparedStoryTimeline,
  STORY_CYCLE_DURATION_MS,
} from "~/utils/storyCycle";
import {
  getMigrationStoryCyclePoints,
  migrationStoryCycleDefinitions,
} from "~/utils/migrationStoryData";
import {
  buildMigrationNarrationTimingAudit,
  buildMigrationActResidenceNarrationSchedule,
  estimateMigrationNarrationSpeechDurationSeconds,
  resolveMigrationActStoryNarrationCue,
  type MigrationActScheduledResidenceNarrationCue,
  type MigrationActStoryNarrationCueId,
} from "~/utils/migrationActs/storyNarration";

type MigrationActRuntimeOptions = {
  act?: StoryAct;
  surfaceId?: MigrationActSurfaceId;
  cycleRuns?: MigrationActCycleRun[];
  runtimeDriver?: MigrationActRuntimeDriver;
  clock?: MigrationActClock;
  audioService?: MigrationActAudioService;
  gestureService?: MigrationActGestureService;
  movementService?: MigrationActMovementService;
  movementRecognitionService?: MigrationActMovementRecognitionService;
  seasonAudioService?: MigrationActSeasonAudioService;
  narrationService?: MigrationActNarrationService;
  translate?: (key: string, params?: Record<string, string | number>) => string;
};

type GuidedGesturePreparationOptions = {
  gestureId: StoryGestureId;
  demonstrationBars: number;
  handoverStartBarOffsetMs?: number;
  onPreparationBar?: (barIndex: number) => void;
  onHandoverStart?: () => void;
  onAttemptStart?: () => void;
};

type GuidedGesturePracticeOptions = Omit<
  GuidedGesturePreparationOptions,
  "gestureId" | "demonstrationBars" | "onPreparationBar"
>;

type GuidedRecognitionPurpose = "idle" | "practice-gating" | "passive-feedback";
type PendingStoryNarrationSequence = {
  runId: number;
  cueIds: readonly MigrationActStoryNarrationCueId[];
  payload: MigrationActNarrationEventPayload;
  startTransportMs: number;
  onComplete?: () => void;
};

type PrepareCycleOptions = {
  preserveMovement?: boolean;
};

const toStoryNarrationCueId = (cueId: string) =>
  cueId as MigrationActStoryNarrationCueId;

const toStoryNarrationCueIds = (cueIds: readonly string[]) =>
  cueIds.map(toStoryNarrationCueId);

export type MigrationActRuntimeDriver = {
  requestFrame: (callback: FrameRequestCallback) => number;
  cancelFrame: (frameId: number) => void;
};

export type MigrationActClock = {
  now: () => number;
};

export type MigrationActAudioService = Pick<
  ReturnType<typeof useAudioStore>,
  | "baseRhythmLoop"
  | "startBaseRhythmLoop"
  | "pauseBaseRhythmLoop"
  | "resumeBaseRhythmLoop"
  | "stopBaseRhythmLoop"
  | "resetBaseRhythmLoop"
  | "fadeOutBaseRhythmLoop"
  | "getBaseRhythmTransportTimeMs"
  | "getBeatDurationMs"
  | "getMsUntilNextBaseRhythmBeat"
>;

export type MigrationActGestureService = ReturnType<
  typeof useMigrationActMovementSession
>;

export type MigrationActMovementService = ReturnType<
  typeof useMigrationActMovement
>;

export type MigrationActMovementRecognitionService = ReturnType<
  typeof useMigrationActMovementRecognition
>;

export type MigrationActNarrationService = Pick<
  ReturnType<typeof useNarration>,
  "play" | "stop"
>;

const browserRuntimeDriver: MigrationActRuntimeDriver = {
  requestFrame: (callback) =>
    typeof requestAnimationFrame === "function"
      ? requestAnimationFrame(callback)
      : 0,
  cancelFrame: (frameId) => {
    if (typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(frameId);
    }
  },
};

const browserClock: MigrationActClock = {
  now: () =>
    typeof performance === "undefined" ? Date.now() : performance.now(),
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unknown migration runtime error.";

const hasBlockingPause = (pauseReasons: MigrationActPauseReason[]) =>
  pauseReasons.includes("user") || pauseReasons.includes("system");

export const useMigrationActRuntime = ({
  act,
  surfaceId = act?.id ?? "story-stage",
  cycleRuns: providedCycleRuns,
  runtimeDriver = browserRuntimeDriver,
  clock = browserClock,
  audioService,
  gestureService,
  movementService,
  movementRecognitionService,
  seasonAudioService,
  narrationService,
  translate,
}: MigrationActRuntimeOptions) => {
  const store = useMigrationActStore();
  const i18n = translate ? null : useI18n();
  const t =
    translate ??
    ((key: string, params?: Record<string, string | number>) =>
      String(i18n?.t(key, params ?? {})));
  const audioStore = audioService ?? useAudioStore();
  const storyEngine = useStoryEngine();
  const storyRuntimeStore = useStoryRuntimeStore();
  const gestures = gestureService ?? useMigrationActMovementSession();
  const movement = movementService ?? useMigrationActMovement();
  const movementRecognition =
    movementRecognitionService ?? useMigrationActMovementRecognition();
  const seasonAudio =
    seasonAudioService ??
    useMigrationActSeasonAudio({
      getTransportSeconds: () =>
        audioStore.getBaseRhythmTransportTimeMs() / 1000,
    });
  const narration = narrationService ?? useNarration();
  const cycleRuns =
    providedCycleRuns ?? (act ? resolveMigrationActCycleRuns(act) : []);

  let animationFrameId = 0;
  let lastFrameAtMs: number | null = null;
  let runId = 0;
  let disposed = false;
  let initialized = false;
  let movementFeedbackExpiresAtMs: number | null = null;
  let handledMovementFeedbackId: string | null = null;
  let initialCountdownStartTransportMs: number | null = null;
  let pendingStoryNarrationSequences: PendingStoryNarrationSequence[] = [];
  let finalResidenceSummaryPromise: Promise<void> | null = null;
  let resolveFinalResidenceSummary: (() => void) | null = null;
  let pausedFromState: "initial_countdown" | "playing" | null = null;
  let phaseMovementScheduledStartTransportMs: number | null = null;
  let cycleTransitionStartedAtTransportMs: number | null = null;
  let cycleTransitionTargetIndex: number | null = null;
  let suppressNextCycleIntro = false;
  let residenceNarrationSchedule: MigrationActScheduledResidenceNarrationCue[] =
    [];
  let authoredNarrationActiveEventId: string | null = null;
  let authoredNarrationQueuedCount = 0;
  let lastAuthoredNarrationEndedTransportMs: number | null = null;
  let handledResidenceNarrationCueIds = new Set<string>();
  const guidedInterludeActive = ref(false);
  const tutorialPlaybackMode = ref<
    "demonstration" | "practice" | "story" | null
  >(null);
  const guidedRecognitionPurpose = ref<GuidedRecognitionPurpose>("idle");
  const tutorialRepetitionIndex = ref(0);
  const guidedStoryTransitionActive = ref(false);
  let tutorialMovement: ResolvedMigrationMovement | null = null;
  let tutorialPlaybackStartTransportMs: number | null = null;
  let tutorialDemonstrationDurationMs = 0;
  let tutorialDemonstrationRepetitions = 0;
  let tutorialDemonstrationResolver: (() => void) | null = null;
  let tutorialDemonstrationHandsOffToPractice = false;
  let onTutorialRepetition: ((index: number) => void) | null = null;
  let guidedInterludeRevision = 0;
  let guidedTransitionStartElapsedMs = 0;
  let guidedTransitionTargetElapsedMs = 0;
  let guidedTransitionStartTransportMs = 0;
  let guidedTransitionDurationMs = 0;
  let guidedTransitionResolver: (() => void) | null = null;
  let guidedTransitionBarIndex = -1;
  let onGuidedTransitionBar: ((index: number) => void) | null = null;
  let guidedBarWaits: Array<{
    targetTransportMs: number;
    resolve: () => void;
  }> = [];
  const avatarPlaybackOwner = ref<AvatarPlaybackOwner>("idle");
  const scheduledNextOwner = ref<AvatarPlaybackOwner | null>(null);
  const scheduledOwnerSwitchMs = ref<number | null>(null);
  const lastOwnerSwitchReason = ref<string | null>(null);
  const ownerSwitchTrace = ref<GuidedOwnerSwitchTrace[]>([]);
  let scheduledOwnerResolver: ((switched: boolean) => void) | null = null;
  let handledRecognitionBarEvaluationId: string | null = null;

  const activeEvent = computed(
    () =>
      store.events.find((event) => event.id === store.activeEventId) ?? null,
  );
  const movementPhaseTiming = computed(() =>
    getMigrationMovementPhaseTiming(store.timeline, store.currentTimelineDay),
  );
  const migrationPhaseDurationSeconds = computed(
    () => (movementPhaseTiming.value?.durationMs ?? 0) / 1_000,
  );
  const activeCycleDefinition = computed(() =>
    migrationStoryCycleDefinitions.find(
      (cycle) => cycle.label === store.activeCycleId,
    ),
  );
  const debugSnapshot = computed((): MigrationActDebugSnapshot => {
    const nextEvent =
      store.events.find((event) => event.status === "pending") ?? null;

    return {
      cycle: store.activeCycleRun?.title ?? store.activeCycleId ?? "",
      currentStoryDate: store.currentDate,
      experienceTimeSeconds: store.currentElapsedMs / 1_000,
      nextEvent: nextEvent?.eventType ?? null,
      nextEventExperienceTimeSeconds: nextEvent
        ? nextEvent.boundaryTimeMs / 1_000
        : null,
      phase: store.currentPhase,
      mapCameraMode: store.mapCameraMode,
      overlayVisible: store.cycleOverlay.visible,
      cycleTransitionOverlayVisible: store.cycleTransitionOverlay.visible,
    };
  });
  const usesGestureOwner = computed(
    () =>
      avatarPlaybackOwner.value === "departure" ||
      avatarPlaybackOwner.value === "arrival",
  );
  const instructorFrame = computed(() =>
    usesGestureOwner.value
      ? gestures.instructorFrame.value
      : movement.instructorFrame.value,
  );
  const instructorSourceAspect = computed(() =>
    usesGestureOwner.value
      ? gestures.instructorSourceAspect.value
      : movement.sourceAspect.value,
  );
  const guidedTrace = computed(() => {
    const masterTransportMs = audioStore.getBaseRhythmTransportTimeMs();
    const position = resolveGuidedTransportPosition(
      masterTransportMs,
      audioStore.getBeatDurationMs(),
    );
    const lastBeat = movementRecognition.lastBeatEvaluation.value;
    const lastBar = movementRecognition.lastBarEvaluation.value;
    const renderedMovementId = usesGestureOwner.value
      ? gestures.store.activeGestureId
      : (movement.resolvedMovement.value?.movementId ?? null);

    return {
      runtimeRunId: runId,
      guidedInterludeRevision,
      playbackState: store.playbackState,
      pauseReasons: [...store.pauseReasons],
      masterTransportMs,
      masterBarIndex: position.barIndex,
      masterBeatIndex: position.beatIndex,
      musicSourceTimeMs: masterTransportMs,
      storyTimeMs: store.currentElapsedMs,
      seasonalThemeId: store.seasonAudio.currentSeason,
      seasonalThemeSourceTimeMs: null,
      guidedPhase: store.guided.phase,
      tutorialPlaybackMode: tutorialPlaybackMode.value,
      guidedRecognitionPurpose: guidedRecognitionPurpose.value,
      gestureState: gestures.store.state,
      gestureId: gestures.store.activeGestureId,
      gestureCompletionStatus:
        gestures.store.latestEvaluationResult?.status ?? null,
      avatarPlaybackOwner: avatarPlaybackOwner.value,
      renderedMovementId,
      avatarSourceTimeMs: usesGestureOwner.value
        ? gestures.store.currentSourceTimeMs
        : movement.movementSourceTimeMs.value,
      recognitionSessionId: lastBeat?.sessionId ?? lastBar?.sessionId ?? null,
      recognitionProfile: movementRecognition.recognitionProfile.value,
      recognitionMovementId:
        movementRecognition.diagnostics.value.currentMovementId,
      recognitionBarIndex:
        movementRecognition.diagnostics.value.currentBarIndex,
      recognitionBeatIndex:
        movementRecognition.diagnostics.value.currentBeat ?? null,
      recognitionSourceTimeMs: movementRecognition.recognitionActive.value
        ? position.barLocalMs
        : null,
      scheduledNextOwner: scheduledNextOwner.value,
      scheduledOwnerSwitchMs: scheduledOwnerSwitchMs.value,
      lastOwnerSwitchReason: lastOwnerSwitchReason.value,
      ownerSwitchPromisePending: scheduledOwnerResolver !== null,
      demonstrationPromisePending: tutorialDemonstrationResolver !== null,
      storyTransitionPromisePending: guidedTransitionResolver !== null,
      guidedBarWaitsPending: guidedBarWaits.length,
      movementLoaded: usesGestureOwner.value
        ? gestures.store.movementLoaded
        : movement.movementLoaded.value,
      movementLoadError: usesGestureOwner.value
        ? gestures.store.movementLoadError
        : movement.movementLoadError.value,
    } satisfies import("~/types/migrationAct").GuidedAct2Trace;
  });

  const getMovementOwner = (
    resolved: ResolvedMigrationMovement,
  ): AvatarPlaybackOwner => {
    if (resolved.movementId === "summer-step") return "summer";
    if (resolved.movementId === "winter-step") return "winter";
    return resolved.direction === "return"
      ? "spring-migration"
      : "autumn-migration";
  };

  const commitOwnerSwitch = (
    toOwner: AvatarPlaybackOwner,
    scheduledTransportMs: number,
    reason: string,
  ) => {
    const actualTransportMs = audioStore.getBaseRhythmTransportTimeMs();
    const fromOwner = avatarPlaybackOwner.value;
    avatarPlaybackOwner.value = toOwner;
    scheduledNextOwner.value = null;
    scheduledOwnerSwitchMs.value = null;
    lastOwnerSwitchReason.value = reason;
    ownerSwitchTrace.value.push({
      fromOwner,
      toOwner,
      scheduledTransportMs,
      actualTransportMs,
      reason,
    });
    scheduledOwnerResolver?.(true);
    scheduledOwnerResolver = null;
  };

  const switchAvatarOwnerNow = (owner: AvatarPlaybackOwner, reason: string) => {
    if (avatarPlaybackOwner.value === owner) return;
    commitOwnerSwitch(owner, audioStore.getBaseRhythmTransportTimeMs(), reason);
  };

  const scheduleOwnerSwitch = (
    owner: AvatarPlaybackOwner,
    scheduledTransportMs: number,
    reason: string,
  ) => {
    scheduledOwnerResolver?.(false);
    if (audioStore.getBaseRhythmTransportTimeMs() >= scheduledTransportMs) {
      commitOwnerSwitch(owner, scheduledTransportMs, reason);
      return Promise.resolve(true);
    }
    scheduledNextOwner.value = owner;
    scheduledOwnerSwitchMs.value = scheduledTransportMs;
    lastOwnerSwitchReason.value = reason;
    return new Promise<boolean>((resolve) => {
      scheduledOwnerResolver = resolve;
    });
  };

  const cancelScheduledOwnerSwitch = () => {
    scheduledNextOwner.value = null;
    scheduledOwnerSwitchMs.value = null;
    scheduledOwnerResolver?.(false);
    scheduledOwnerResolver = null;
  };

  const nextRunId = () => {
    runId++;
    return runId;
  };

  const isCurrentRun = (candidate: number) => !disposed && candidate === runId;
  const isAutoProgressEnabled = () =>
    store.debug.enabled && store.debug.autoProgressEnabled;

  const getDateDistanceDays = (startDate: string, endDate: string) =>
    Math.max(
      0,
      Math.round(
        (new Date(`${endDate}T00:00:00.000Z`).getTime() -
          new Date(`${startDate}T00:00:00.000Z`).getTime()) /
          (24 * 60 * 60 * 1000),
      ),
    );

  const getCycleLabel = (cycleRun: MigrationActCycleRun) =>
    `${cycleRun.cycleStartYear}-${cycleRun.cycleStartYear + 1}`;

  const getNarrationBasePayload = (
    event: MigrationActNarrationSemanticEvent,
    options: {
      cueId?: string;
      cueRole?: MigrationActNarrationCueRole;
      eventId?: string;
    } = {},
  ): MigrationActNarrationEventPayload => {
    const cycleRun = store.activeCycleRun;
    const definition = activeCycleDefinition.value;
    const previousDefinition =
      store.activeCycleIndex > 0
        ? migrationStoryCycleDefinitions.find(
            (cycle) =>
              cycle.label ===
              store.cycleRuns[store.activeCycleIndex - 1]?.cycleId,
          )
        : null;
    const referenceDefinition = migrationStoryCycleDefinitions[0] ?? null;

    return {
      event,
      eventId:
        options.eventId ??
        `${runId}:${cycleRun?.id ?? "none"}:${options.cueId ?? event}`,
      cueId: options.cueId,
      cueRole: options.cueRole,
      cycleRunId: cycleRun?.id ?? null,
      cycleId: cycleRun?.cycleId ?? null,
      step: definition?.step ?? null,
      totalCycles: store.cycleRuns.length,
      startYear: cycleRun?.cycleStartYear ?? null,
      endYear: cycleRun ? cycleRun.cycleStartYear + 1 : null,
      currentPhase: store.currentPhase,
      winterRegion: definition?.wintering ?? null,
      previousWinterRegion: previousDefinition?.wintering ?? null,
      referenceWinterRegion: referenceDefinition?.wintering ?? null,
    };
  };

  const getMigrationEventPayload = (
    semanticEvent: MigrationActNarrationSemanticEvent,
    departure: MigrationActEvent,
    arrival: MigrationActEvent | null,
    direction: "south" | "north",
    options: {
      cueId?: string;
      cueRole?: MigrationActNarrationCueRole;
      eventId?: string;
    } = {},
  ): MigrationActNarrationEventPayload => ({
    ...getNarrationBasePayload(semanticEvent, options),
    realDepartureDate: departure.boundaryDate,
    realArrivalDate: arrival?.boundaryDate,
    realMigrationDurationDays: arrival
      ? getDateDistanceDays(departure.boundaryDate, arrival.boundaryDate)
      : undefined,
    experienceMigrationDurationSeconds: arrival
      ? Math.max(0, arrival.boundaryTimeMs - departure.boundaryTimeMs) / 1_000
      : undefined,
    experienceMigrationDurationSecondsExact: arrival
      ? Math.max(0, arrival.boundaryTimeMs - departure.boundaryTimeMs) / 1_000
      : undefined,
    experienceMigrationDurationSecondsSpoken: arrival
      ? Math.round(
          Math.max(0, arrival.boundaryTimeMs - departure.boundaryTimeMs) /
            1_000,
        )
      : undefined,
    direction,
  });

  const emitNarrationEvent = (
    payload: MigrationActNarrationEventPayload,
    options: {
      displayTitle?: string;
      displayText?: string;
      cueKey?: string;
      cueParams?: Record<string, string | number>;
      speak?: boolean;
      behavior?: "replace" | "queue" | "skip-if-speaking";
    } = {},
  ) => {
    if (store.lastNarrationEventIds.includes(payload.eventId)) return false;

    store.recordNarrationEvent(payload);
    if ((options.displayTitle || options.displayText) && !options.speak) {
      store.setStoryNarration({
        eventId: payload.eventId,
        title: options.displayTitle ?? "",
        text: options.displayText ?? "",
      });
    }
    if (options.speak && options.cueKey) {
      void narration.play(options.cueKey, {
        params: options.cueParams,
        behavior: options.behavior ?? "replace",
        onStart: () => {
          if (options.displayTitle || options.displayText) {
            store.setStoryNarration({
              eventId: payload.eventId,
              title: options.displayTitle ?? "",
              text: options.displayText ?? "",
            });
          }
        },
      });
    }

    return true;
  };

  const getStoryCueParams = (
    payload: MigrationActNarrationEventPayload,
  ): Record<string, string | number> => ({
    ...(payload.startYear !== null ? { startYear: payload.startYear } : {}),
    ...(payload.endYear !== null ? { endYear: payload.endYear } : {}),
    ...(payload.step !== null ? { step: payload.step } : {}),
    ...(payload.totalCycles ? { totalCycles: payload.totalCycles } : {}),
    ...(payload.realDepartureDate
      ? { realDepartureDate: payload.realDepartureDate }
      : {}),
    ...(payload.realArrivalDate
      ? { realArrivalDate: payload.realArrivalDate }
      : {}),
    ...(payload.realMigrationDurationDays !== undefined
      ? { realMigrationDays: payload.realMigrationDurationDays }
      : {}),
    ...(payload.experienceMigrationDurationSecondsExact !== undefined
      ? {
          experienceDurationSecondsExact:
            payload.experienceMigrationDurationSecondsExact,
          experienceMigrationDurationSecondsExact:
            payload.experienceMigrationDurationSecondsExact,
        }
      : {}),
    ...(payload.experienceMigrationDurationSecondsSpoken !== undefined
      ? {
          experienceDurationSecondsSpoken:
            payload.experienceMigrationDurationSecondsSpoken,
          experienceMigrationDurationSecondsSpoken:
            payload.experienceMigrationDurationSecondsSpoken,
        }
      : {}),
    ...(payload.direction ? { direction: payload.direction } : {}),
    ...(payload.currentPhase ? { currentPhase: payload.currentPhase } : {}),
    ...(payload.winterRegion ? { winterRegion: payload.winterRegion } : {}),
    ...(payload.previousWinterRegion
      ? { previousWinterRegion: payload.previousWinterRegion }
      : {}),
    ...(payload.referenceWinterRegion
      ? { referenceWinterRegion: payload.referenceWinterRegion }
      : {}),
  });

  const playStoryNarrationCue = (
    cueId: MigrationActStoryNarrationCueId,
    payload: MigrationActNarrationEventPayload,
    options: {
      awaitSpeech?: boolean;
      behavior?: "replace" | "queue" | "skip-if-speaking";
    } = {},
  ) => {
    const cue = resolveMigrationActStoryNarrationCue(cueId);
    const eventId = `${runId}:${payload.cycleRunId ?? "act"}:${cue.id}`;
    if (store.lastNarrationEventIds.includes(eventId)) {
      return Promise.resolve(false);
    }

    const cuePayload = {
      ...payload,
      eventId,
      cueId: cue.id,
      cueRole: cue.role,
    };
    const params = getStoryCueParams(cuePayload);
    const title = String(t(`${cue.textKey}.title`, params));
    const text = String(t(`${cue.textKey}.text`, params));

    store.recordNarrationEvent(cuePayload);
    if (cue.display && !cue.speak) {
      store.setStoryNarration({ eventId, title, text });
    }
    if (!cue.speak) return Promise.resolve(true);

    let speechStarted = false;
    let speechEnded = false;
    authoredNarrationQueuedCount++;
    const promise = narration.play(`${cue.textKey}.text`, {
      params,
      behavior: options.behavior ?? "queue",
      onStart: () => {
        speechStarted = true;
        authoredNarrationQueuedCount = Math.max(
          0,
          authoredNarrationQueuedCount - 1,
        );
        authoredNarrationActiveEventId = eventId;
        if (cue.display) {
          store.setStoryNarration({ eventId, title, text });
        }
      },
      onEnd: () => {
        speechEnded = true;
        authoredNarrationQueuedCount = Math.max(
          0,
          authoredNarrationQueuedCount - 1,
        );
        if (authoredNarrationActiveEventId === eventId) {
          authoredNarrationActiveEventId = null;
          lastAuthoredNarrationEndedTransportMs =
            audioStore.getBaseRhythmTransportTimeMs();
        }
      },
    });
    const trackedPromise = promise.then((result) => {
      if (!speechStarted || !speechEnded) {
        authoredNarrationQueuedCount = Math.max(
          0,
          authoredNarrationQueuedCount - 1,
        );
      }

      return result;
    });

    if (options.awaitSpeech) {
      return trackedPromise.then(() => true);
    }

    void trackedPromise;
    return Promise.resolve(true);
  };

  const isAuthoredNarrationBusy = () =>
    authoredNarrationActiveEventId !== null || authoredNarrationQueuedCount > 0;

  const resetAuthoredNarrationState = () => {
    authoredNarrationActiveEventId = null;
    authoredNarrationQueuedCount = 0;
    lastAuthoredNarrationEndedTransportMs = null;
  };

  const getResidenceCueEventId = (
    scheduledCue: MigrationActScheduledResidenceNarrationCue,
  ) => `${store.activeCycleRun?.id ?? "none"}:${scheduledCue.cueId}`;

  const getOneBarDurationMs = () =>
    audioStore.getBeatDurationMs() *
    MIGRATION_RECOGNITION_THRESHOLDS.beatsPerBar;

  const hasQuietBarAfterAuthoredCue = () =>
    lastAuthoredNarrationEndedTransportMs === null ||
    audioStore.getBaseRhythmTransportTimeMs() -
      lastAuthoredNarrationEndedTransportMs >=
      getOneBarDurationMs();

  const isAuthoredCueProtectedWindow = () => {
    if (pendingStoryNarrationSequences.length > 0) return true;

    const oneBarMs = getOneBarDurationMs();
    return residenceNarrationSchedule.some(
      (scheduledCue) =>
        !handledResidenceNarrationCueIds.has(
          getResidenceCueEventId(scheduledCue),
        ) &&
        scheduledCue.phase === store.currentPhase &&
        store.currentElapsedMs >= scheduledCue.triggerElapsedMs - oneBarMs,
    );
  };

  const canResidenceCueFit = (
    scheduledCue: MigrationActScheduledResidenceNarrationCue,
  ) => {
    const cue = resolveMigrationActStoryNarrationCue(scheduledCue.cueId);
    const params = getStoryCueParams(
      getNarrationBasePayload(
        scheduledCue.phase === "summer_rest"
          ? "summerResidenceTiming"
          : "winterResidenceTiming",
        { cueId: cue.id, cueRole: cue.role },
      ),
    );
    const text = String(t(`${cue.textKey}.text`, params));
    const estimatedDurationMs =
      estimateMigrationNarrationSpeechDurationSeconds(text) * 1_000;
    const oneBarMs = getOneBarDurationMs();
    const availableWindowMs =
      scheduledCue.nextCountdownStartSecond * 1_000 - store.currentElapsedMs;

    return availableWindowMs >= estimatedDurationMs + oneBarMs;
  };

  const playStoryNarrationSequence = async (
    cueIds: readonly MigrationActStoryNarrationCueId[],
    payload: MigrationActNarrationEventPayload,
    currentRunId: number,
    options: {
      completeAfter?: boolean;
    } = {},
  ) => {
    for (const cueId of cueIds) {
      if (!isCurrentRun(currentRunId)) return;
      await playStoryNarrationCue(cueId, payload, {
        awaitSpeech: true,
        behavior: "queue",
      });
    }

    if (options.completeAfter && isCurrentRun(currentRunId)) {
      if (act) storyRuntimeStore.completeAct();
    }
  };

  const scheduleStoryNarrationSequence = (
    cueIds: readonly MigrationActStoryNarrationCueId[],
    payload: MigrationActNarrationEventPayload,
    currentRunId: number,
    delayTransportMs: number,
    onComplete?: () => void,
  ) => {
    pendingStoryNarrationSequences.push({
      runId: currentRunId,
      cueIds,
      payload,
      startTransportMs:
        audioStore.getBaseRhythmTransportTimeMs() +
        Math.max(0, delayTransportMs),
      onComplete,
    });
  };

  const playDueStoryNarrationSequences = () => {
    if (!pendingStoryNarrationSequences.length) return;

    const transportMs = audioStore.getBaseRhythmTransportTimeMs();
    const due = pendingStoryNarrationSequences.filter(
      (sequence) => transportMs >= sequence.startTransportMs,
    );
    pendingStoryNarrationSequences = pendingStoryNarrationSequences.filter(
      (sequence) => transportMs < sequence.startTransportMs,
    );

    for (const sequence of due) {
      void playStoryNarrationSequence(
        sequence.cueIds,
        sequence.payload,
        sequence.runId,
      ).finally(() => sequence.onComplete?.());
    }
  };

  const resetFinalResidenceSummaryState = () => {
    resolveFinalResidenceSummary?.();
    finalResidenceSummaryPromise = null;
    resolveFinalResidenceSummary = null;
  };

  const shouldUseFinalResidenceSummary = () =>
    store.playbackMode === "story" &&
    store.activeCycleIndex === store.cycleRuns.length - 1;

  const scheduleFinalResidenceSummary = (
    currentRunId: number,
    leadingCueIds: readonly MigrationActStoryNarrationCueId[],
  ) => {
    if (finalResidenceSummaryPromise || !shouldUseFinalResidenceSummary()) {
      return;
    }

    finalResidenceSummaryPromise = new Promise<void>((resolve) => {
      resolveFinalResidenceSummary = resolve;
    });

    scheduleStoryNarrationSequence(
      [
        ...leadingCueIds,
        ...toStoryNarrationCueIds(getMigrationChangeFlowCompletionCueIds()),
      ],
      getNarrationBasePayload("actSummary"),
      currentRunId,
      getOneBarDurationMs(),
      () => {
        resolveFinalResidenceSummary?.();
        resolveFinalResidenceSummary = null;
      },
    );
  };

  const playScheduledResidenceNarration = (
    previousElapsedMs: number,
    currentElapsedMs: number,
  ) => {
    void previousElapsedMs;
    void currentElapsedMs;
    if (
      store.isGestureActive ||
      store.playbackState !== "playing" ||
      store.temporaryMovementFeedbackId ||
      isAuthoredNarrationBusy()
    ) {
      return;
    }

    for (const scheduledCue of residenceNarrationSchedule) {
      const residenceEventId = getResidenceCueEventId(scheduledCue);
      if (handledResidenceNarrationCueIds.has(residenceEventId)) continue;
      if (
        store.currentElapsedMs >= scheduledCue.triggerElapsedMs &&
        store.currentPhase === scheduledCue.phase
      ) {
        if (!canResidenceCueFit(scheduledCue)) {
          handledResidenceNarrationCueIds.add(residenceEventId);
          continue;
        }
        if (!hasQuietBarAfterAuthoredCue()) continue;

        const cue = resolveMigrationActStoryNarrationCue(scheduledCue.cueId);
        const event =
          scheduledCue.phase === "summer_rest"
            ? "summerResidenceTiming"
            : "winterResidenceTiming";
        void playStoryNarrationCue(
          scheduledCue.cueId,
          getNarrationBasePayload(event, {
            cueId: cue.id,
            cueRole: cue.role,
          }),
        );
        handledResidenceNarrationCueIds.add(residenceEventId);
      }
    }
  };

  const resetContinuousPhaseEngagement = () => {
    const cycleRunId = store.activeCycleRun?.id ?? "none";
    const phase = store.currentPhase;
    const phaseKey = phase ? `${cycleRunId}:${phase}` : null;

    if (store.engagementNudge.phaseKey !== phaseKey) {
      store.resetEngagementNudge(phaseKey);
    }
  };

  const startActiveCycleOrientation = (
    options: { suppressNarration?: boolean; suppressOverlay?: boolean } = {},
  ) => {
    const cycleRun = store.activeCycleRun;
    if (!cycleRun) return;

    if (!options.suppressOverlay) {
      store.showCycleOverlay({
        cycleRunId: cycleRun.id,
        title: getCycleLabel(cycleRun),
        subtitleKey:
          store.activeCycleIndex === 0
            ? "story.acts.act3.overlay.reference"
            : "story.acts.act3.overlay.cycle",
        subtitleParams: {
          step: store.activeCycleIndex + 1,
          total: store.cycleRuns.length,
        },
        durationMs: audioStore.getBeatDurationMs() * 4,
      });
    }
    const cueId = getMigrationChangeFlowCycleIntroCueId(cycleRun.cycleId);
    if (cueId && !options.suppressNarration) {
      void playStoryNarrationCue(
        toStoryNarrationCueId(cueId),
        getNarrationBasePayload("cycleIntro"),
      );
    }
  };

  const handleContinuousEngagementEvaluation = () => {
    const evaluation = movementRecognition.lastBarEvaluation.value;
    if (
      !evaluation ||
      evaluation.evaluationId === handledRecognitionBarEvaluationId ||
      !store.currentPhase ||
      store.isGestureActive
    ) {
      return;
    }

    handledRecognitionBarEvaluationId = evaluation.evaluationId;
    resetContinuousPhaseEngagement();
    store.recordEngagementEvaluation(evaluation.status);
    if (
      !store.engagementNudge.nudged &&
      store.engagementNudge.consecutiveLowParticipationBars >= 3
    ) {
      if (isAuthoredNarrationBusy() || isAuthoredCueProtectedWindow()) {
        store.markEngagementNudged();
        return;
      }

      const text = String(t("story.migrationPanel.engagement.nudge"));
      emitNarrationEvent(getNarrationBasePayload("engagementNudge"), {
        displayTitle: String(t("story.migrationPanel.engagement.title")),
        displayText: text,
        cueKey: "story.migrationPanel.engagement.nudge",
        speak: true,
        behavior: "skip-if-speaking",
      });
      store.markEngagementNudged();
    }
  };

  const getDebugTimingTable = () =>
    store.cycleRuns.map((cycleRun) => {
      const points = getMigrationStoryCyclePoints(cycleRun.cycleId);
      const timeline = buildPreparedStoryTimeline(
        points,
        STORY_CYCLE_DURATION_MS,
      );
      const events = createMigrationActEvents(cycleRun, timeline);

      return {
        cycle: getCycleLabel(cycleRun),
        cycleId: cycleRun.cycleId,
        events: events.map((event) => ({
          event: event.eventType,
          realDate: event.boundaryDate,
          experienceSecond: event.boundaryTimeMs / 1_000,
        })),
        narrationTiming: buildMigrationNarrationTimingAudit([cycleRun]),
        durationSeconds: (timeline.at(-1)?.endMs ?? 0) / 1_000,
      };
    });

  const installDebugUtility = () => {
    if (!import.meta.dev || typeof window === "undefined") return;

    Object.assign(window, {
      __migrationActDebug: {
        getSnapshot: () => debugSnapshot.value,
        getTimelines: getDebugTimingTable,
      },
    });
  };

  const cancelFrame = () => {
    if (!animationFrameId) return;

    runtimeDriver.cancelFrame(animationFrameId);
    animationFrameId = 0;
  };

  const clearMovementFeedback = () => {
    movementFeedbackExpiresAtMs = null;
    store.setTemporaryMovementFeedback(null);
  };

  const showMovementSuccessFeedback = (evaluationId: string) => {
    if (handledMovementFeedbackId === evaluationId) return;

    handledMovementFeedbackId = evaluationId;
    clearMovementFeedback();
    store.setTemporaryMovementFeedback(evaluationId);
    movementFeedbackExpiresAtMs =
      audioStore.getBaseRhythmTransportTimeMs() + 1_000;
  };

  const startGuidedMovementRecognition = (
    purpose: Exclude<GuidedRecognitionPurpose, "idle">,
  ) => {
    if (!tutorialMovement || tutorialPlaybackStartTransportMs === null) return;

    guidedRecognitionPurpose.value = purpose;

    const currentTransportMs = audioStore.getBaseRhythmTransportTimeMs();
    const movementElapsedMs = Math.max(
      0,
      currentTransportMs - tutorialPlaybackStartTransportMs,
    );
    const recognitionAlreadyAligned =
      movementRecognition.recognitionActive.value &&
      movementRecognition.recognitionProfile.value ===
        tutorialMovement.recognitionProfile &&
      movementRecognition.diagnostics.value.currentMovementId ===
        tutorialMovement.movementId;

    if (recognitionAlreadyAligned) return;

    movementRecognition.start(tutorialMovement.recognitionProfile, {
      transportTimeMs: currentTransportMs,
      movementElapsedMs,
      prerollMs: tutorialMovement.playbackTiming.prerollMs,
      movementId: tutorialMovement.movementId,
      negativeFeedbackEnabled: purpose === "practice-gating",
    });
  };

  const pauseGuidedMovementRecognition = () => {
    guidedRecognitionPurpose.value = "idle";
    movementRecognition.pause();
  };

  const scheduleFrame = () => {
    if (animationFrameId || disposed) return;

    animationFrameId = runtimeDriver.requestFrame(tick);
  };

  const synchronizeSeasonForCurrentDate = () => {
    if (!store.currentDate || store.playbackState === "completed") return;
    void seasonAudio.changeForDate(store.currentDate);
  };

  const getActiveTargetRegion = () => {
    const cycleId = store.activeCycleId;

    return (
      migrationStoryCycleDefinitions.find((cycle) => cycle.label === cycleId)
        ?.wintering ?? null
    );
  };

  const resolveCurrentPhaseMovement = () => {
    const phase = store.currentPhase;
    const timing = movementPhaseTiming.value;

    if (!phase || !timing) return null;

    return resolveMigrationMovement({
      phase,
      direction: getMigrationMovementDirection(phase),
      phaseDurationMs: timing.durationMs,
      targetRegion: getActiveTargetRegion(),
    });
  };

  const selectMovementForCurrentPhase = () => {
    const resolved = resolveCurrentPhaseMovement();

    movement.select(resolved);
    return resolved;
  };

  const prepareRecognitionForCurrentPhase = () => {
    const resolved = resolveCurrentPhaseMovement();

    movementRecognition.prepare(resolved?.recognitionProfile ?? null);
  };

  const getCurrentPhaseElapsedMs = () =>
    Math.max(
      0,
      store.currentElapsedMs - (movementPhaseTiming.value?.startMs ?? 0),
    );

  const getCurrentMovementElapsedMs = () =>
    getCurrentPhaseElapsedMs() +
    (resolveCurrentPhaseMovement()?.playbackTiming.prerollMs ?? 0);

  const getContinuousMovementStartAnchorTransportMs = (
    movement: ResolvedMigrationMovement,
  ) => {
    const transportMs = audioStore.getBaseRhythmTransportTimeMs();

    if (getCurrentPhaseElapsedMs() > 80) {
      return transportMs - getCurrentMovementElapsedMs();
    }

    const countOneTransportMs = resolvePreviousGuidedBarBoundary(
      transportMs,
      audioStore.getBeatDurationMs(),
      true,
    );

    return countOneTransportMs - movement.playbackTiming.prerollMs;
  };

  const getTransportMovementElapsedMs = () =>
    phaseMovementScheduledStartTransportMs === null
      ? getCurrentMovementElapsedMs()
      : Math.max(
          0,
          audioStore.getBaseRhythmTransportTimeMs() -
            phaseMovementScheduledStartTransportMs,
        );

  const startMovementForCurrentPhase = async () => {
    const sessionId = store.playbackSessionId;
    const resolved = resolveCurrentPhaseMovement();

    if (!resolved) return;
    if (!movement.isMovementReady(resolved.movementId)) {
      if (!(await movement.preload(resolved))) {
        store.setError(
          movement.movementLoadError.value ??
            `Unable to preload ${resolved.movementId}.`,
        );
        return;
      }
      if (disposed || sessionId !== store.playbackSessionId) return;
    }

    resetContinuousPhaseEngagement();
    movement.select(resolved);
    switchAvatarOwnerNow(
      getMovementOwner(resolved),
      `phase:${resolved.movementId}`,
    );
    phaseMovementScheduledStartTransportMs =
      getContinuousMovementStartAnchorTransportMs(resolved);
    const phaseElapsedMs = getTransportMovementElapsedMs();

    movementRecognition.start(resolved.recognitionProfile, {
      transportTimeMs: audioStore.getBaseRhythmTransportTimeMs(),
      movementElapsedMs: phaseElapsedMs,
      prerollMs: resolved.playbackTiming.prerollMs,
      movementId: resolved.movementId,
    });
    if (!movement.activate(resolved, phaseElapsedMs)) {
      store.setError(
        movement.movementLoadError.value ??
          `Unable to start ${resolved.movementId}.`,
      );
      return;
    }

    if (
      disposed ||
      sessionId !== store.playbackSessionId ||
      store.playbackState !== "playing" ||
      hasBlockingPause(store.pauseReasons)
    ) {
      movement.pause();
    }
  };

  const getUpcomingGestureEvent = () =>
    store.events.find((event) => event.status === "pending") ?? null;

  const updateUpcomingGestureCameraWindow = () => {
    const event = getUpcomingGestureEvent();
    if (!event) return;

    const distanceToEventMs = event.boundaryTimeMs - store.currentElapsedMs;
    if (distanceToEventMs < 0 || distanceToEventMs > getOneBarDurationMs()) {
      return;
    }

    store.setMapCameraMode(getMigrationMapCameraModeForEvent(event.eventType));
  };

  const prepareCycle = (index: number, options: PrepareCycleOptions = {}) => {
    const cycleRun = store.cycleRuns[index];
    if (!cycleRun) throw new Error(`Invalid migration cycle index ${index}.`);

    const points = getMigrationStoryCyclePoints(cycleRun.cycleId);
    const timeline = buildPreparedStoryTimeline(
      points,
      STORY_CYCLE_DURATION_MS,
    );
    const events = createMigrationActEvents(cycleRun, timeline);

    if (!options.preserveMovement) movement.stop();
    store.prepareCycle({ activeCycleIndex: index, timeline, events });
    residenceNarrationSchedule =
      buildMigrationActResidenceNarrationSchedule(cycleRun);
    handledResidenceNarrationCueIds = new Set();
    store.setMapCameraMode(
      getMigrationMapCameraModeForPhase(store.currentPhase),
    );
    store.clearStoryNarration();
    resetContinuousPhaseEngagement();
    handledRecognitionBarEvaluationId = null;
    seasonAudio.prepare(store.currentDate);
    selectMovementForCurrentPhase();
    prepareRecognitionForCurrentPhase();
  };

  const areLatLngEqual = (
    actual: MigrationActMapFrame["markerLatLng"] | null | undefined,
    expected: MigrationActMapFrame["markerLatLng"] | null | undefined,
  ) =>
    Boolean(
      actual &&
      expected &&
      Math.abs(actual.lat - expected.lat) < 1e-7 &&
      Math.abs(actual.lng - expected.lng) < 1e-7,
    );

  const isCycleTransitionMapReady = () => {
    const transition = store.cycleTransitionOverlay;
    const expectedFrame = getCurrentMapFrame();
    const reportedLatLng = transition.markerLatLng;
    const expectedLatLng = expectedFrame?.markerLatLng;
    const markerReady = areLatLngEqual(reportedLatLng, expectedLatLng);

    return (
      transition.visible &&
      transition.mapReady &&
      transition.state === "ready" &&
      transition.targetCycleId === store.activeCycleId &&
      transition.targetDate === store.currentDate &&
      transition.targetPhase === store.currentPhase &&
      transition.cameraReady &&
      store.mapCameraMode === "residence" &&
      expectedFrame?.cycleId === transition.targetCycleId &&
      expectedFrame.date === transition.targetDate &&
      expectedFrame.phase === transition.targetPhase &&
      markerReady
    );
  };

  const isCycleTransitionRevealBoundaryReady = (
    transitionElapsedMs: number,
  ) => {
    const transition = store.cycleTransitionOverlay;
    const coverStartedTransportMs = transition.coverStartedTransportMs;
    const readyTransportMs = transition.mapReadyTransportMs;
    const oneBarDurationMs = transition.oneBarDurationMs;

    if (
      coverStartedTransportMs === null ||
      readyTransportMs === null ||
      !isCycleTransitionMapReady()
    ) {
      return false;
    }
    if (transitionElapsedMs < oneBarDurationMs) return false;

    const minimumRevealTransportMs = coverStartedTransportMs + oneBarDurationMs;
    const revealTransportMs =
      readyTransportMs <= minimumRevealTransportMs
        ? minimumRevealTransportMs
        : resolveNextGuidedBarBoundary(
            readyTransportMs,
            audioStore.getBeatDurationMs(),
            true,
          );

    return audioStore.getBaseRhythmTransportTimeMs() >= revealTransportMs;
  };

  const synchronizeAudioForPauseReasons = async () => {
    if (hasBlockingPause(store.pauseReasons)) {
      seasonAudio.pause();
      audioStore.pauseBaseRhythmLoop();
      return;
    }

    if (store.pauseReasons.includes("gesture")) {
      await audioStore.resumeBaseRhythmLoop();
      await seasonAudio.resume();
      return;
    }

    if (store.playbackState === "cycle_transition") {
      await audioStore.resumeBaseRhythmLoop();
      return;
    }

    if (
      store.playbackState === "playing" ||
      store.playbackState === "initial_countdown"
    ) {
      await audioStore.resumeBaseRhythmLoop();
      await seasonAudio.resume();
    }
  };

  const stopTutorialMovement = () => {
    movement.pause();
    pauseGuidedMovementRecognition();
    tutorialPlaybackMode.value = null;
    tutorialRepetitionIndex.value = 0;
    tutorialMovement = null;
    tutorialPlaybackStartTransportMs = null;
    tutorialDemonstrationDurationMs = 0;
    tutorialDemonstrationRepetitions = 0;
    tutorialDemonstrationHandsOffToPractice = false;
    onTutorialRepetition = null;
    const resolveDemonstration = tutorialDemonstrationResolver;
    tutorialDemonstrationResolver = null;
    resolveDemonstration?.();
  };

  const cancelGuidedStoryTransition = () => {
    guidedStoryTransitionActive.value = false;
    guidedTransitionStartElapsedMs = 0;
    guidedTransitionTargetElapsedMs = 0;
    guidedTransitionStartTransportMs = 0;
    guidedTransitionDurationMs = 0;
    guidedTransitionBarIndex = -1;
    onGuidedTransitionBar = null;
    const resolve = guidedTransitionResolver;
    guidedTransitionResolver = null;
    resolve?.();
  };

  const resolveGuidedBarWaits = () => {
    if (guidedBarWaits.length === 0) return;

    const transportMs = audioStore.getBaseRhythmTransportTimeMs();
    const ready = guidedBarWaits.filter(
      (wait) => transportMs >= wait.targetTransportMs,
    );
    if (ready.length === 0) return;

    guidedBarWaits = guidedBarWaits.filter(
      (wait) => transportMs < wait.targetTransportMs,
    );
    ready.forEach((wait) => wait.resolve());
  };

  const cancelGuidedBarWaits = () => {
    const waits = guidedBarWaits;
    guidedBarWaits = [];
    waits.forEach((wait) => wait.resolve());
  };

  const enterGuidedInterlude = async (
    initialMovementOrPreroll: ResolvedMigrationMovement | number | null = null,
  ) => {
    if (guidedInterludeActive.value) return;
    gestures.setNarrationEnabled?.(false);
    const initialMovement =
      initialMovementOrPreroll && typeof initialMovementOrPreroll !== "number"
        ? initialMovementOrPreroll
        : null;

    if (initialMovement && !(await movement.preload(initialMovement))) {
      avatarPlaybackOwner.value = "idle";
      store.setError(
        movement.movementLoadError.value ??
          `Unable to preload ${initialMovement.movementId}.`,
      );
      return;
    }

    movement.pause();
    movementRecognition.pause();
    clearMovementFeedback();
    guidedInterludeRevision++;
    guidedInterludeActive.value = true;
    store.addPauseReason("tutorial");

    if (store.playbackState === "idle") {
      ownerSwitchTrace.value = [];
      lastOwnerSwitchReason.value = null;
      if (act) storyEngine.startAct(act.id);
      seasonAudio.reset();
      audioStore.resetBaseRhythmLoop();
      if (
        initialMovement &&
        !movement.activate(
          initialMovement,
          initialMovement.playbackTiming.prerollMs,
        )
      ) {
        avatarPlaybackOwner.value = "idle";
        store.setError(
          movement.movementLoadError.value ??
            `Unable to start ${initialMovement.movementId}.`,
        );
        return;
      }
      if (initialMovement) {
        tutorialMovement = initialMovement;
        tutorialPlaybackMode.value = "demonstration";
        tutorialPlaybackStartTransportMs =
          -initialMovement.playbackTiming.prerollMs;
        commitOwnerSwitch(getMovementOwner(initialMovement), 0, "guided-start");
      }
      await audioStore.startBaseRhythmLoop(0);
      await seasonAudio.start(store.currentDate);
      store.setPlaybackState("playing");
    }

    lastFrameAtMs = null;
    scheduleFrame();
  };

  const startTutorialPlayback = async (
    resolved: ResolvedMigrationMovement,
    mode: "demonstration" | "practice" | "story",
    prepareBeforeOwnerSwitch?: () => void,
  ) => {
    if (!guidedInterludeActive.value) {
      await enterGuidedInterlude();
    }
    const revision = guidedInterludeRevision;
    const continuesCurrentMovement =
      tutorialMovement?.movementId === resolved.movementId &&
      movement.movementPlaying.value;

    if (!continuesCurrentMovement) {
      stopTutorialMovement();
      const loaded = await movement.preload(resolved);
      if (!loaded) return false;
    }
    tutorialMovement = resolved;
    tutorialPlaybackMode.value = mode;
    tutorialRepetitionIndex.value = mode === "demonstration" ? 1 : 0;
    const currentTransportMs = audioStore.getBaseRhythmTransportTimeMs();
    const movementStartTransportMs = continuesCurrentMovement
      ? Math.max(
          0,
          (tutorialPlaybackStartTransportMs ??
            -resolved.playbackTiming.prerollMs) +
            resolved.playbackTiming.prerollMs,
        )
      : resolveNextGuidedBarBoundary(
          currentTransportMs,
          audioStore.getBeatDurationMs(),
        );
    let ownerSwitch: Promise<boolean> | null = null;
    if (!continuesCurrentMovement) {
      if (!movement.activate(resolved, 0)) return false;
      prepareBeforeOwnerSwitch?.();
      ownerSwitch = scheduleOwnerSwitch(
        getMovementOwner(resolved),
        movementStartTransportMs,
        `${mode}:${resolved.movementId}`,
      );
      tutorialPlaybackStartTransportMs =
        movementStartTransportMs - resolved.playbackTiming.prerollMs;
    } else {
      prepareBeforeOwnerSwitch?.();
    }
    if (!guidedInterludeActive.value || revision !== guidedInterludeRevision) {
      movement.pause();
      return false;
    }
    if (ownerSwitch && !(await ownerSwitch)) return false;
    const playbackOriginMs = tutorialPlaybackStartTransportMs;
    if (playbackOriginMs === null) return false;
    const movementElapsedMs = Math.max(
      0,
      audioStore.getBaseRhythmTransportTimeMs() - playbackOriginMs,
    );
    movement.tick(movementElapsedMs);

    startGuidedMovementRecognition(
      mode === "practice" ? "practice-gating" : "passive-feedback",
    );

    lastFrameAtMs = null;
    scheduleFrame();
    return true;
  };

  const preloadTutorialMovement = (resolved: ResolvedMigrationMovement) =>
    movement.preload(resolved);

  const continueTutorialMovement = () => {
    if (!tutorialMovement || !movement.movementPlaying.value) return false;
    tutorialPlaybackMode.value = "story";
    startGuidedMovementRecognition("passive-feedback");
    return true;
  };

  const startTutorialStoryMovement = async (
    resolved: ResolvedMigrationMovement,
  ) => {
    return await startTutorialPlayback(resolved, "story");
  };

  const playTutorialDemonstration = async (
    resolved: ResolvedMigrationMovement,
    repetitions: number,
    onRepetition?: (index: number) => void,
    options: { handoverToPractice?: boolean } = {},
  ) => {
    const prepareDemonstration = () => {
      tutorialDemonstrationRepetitions = Math.max(1, Math.round(repetitions));
      tutorialDemonstrationDurationMs =
        resolved.playbackTiming.prerollMs +
        tutorialDemonstrationRepetitions *
          audioStore.getBeatDurationMs() *
          MIGRATION_RECOGNITION_THRESHOLDS.beatsPerBar;
      onTutorialRepetition = onRepetition ?? null;
      tutorialDemonstrationHandsOffToPractice =
        options.handoverToPractice === true;
    };
    const started = await startTutorialPlayback(
      resolved,
      "demonstration",
      prepareDemonstration,
    );
    if (!started) {
      const message =
        movement.movementLoadError.value ??
        `Unable to start guided movement "${resolved.movementId}".`;
      store.setError(message);
      throw new Error(message);
    }
    onTutorialRepetition?.(1);

    return new Promise<void>((resolve) => {
      tutorialDemonstrationResolver = resolve;
    });
  };

  const playGuidedGesturePreparation = async ({
    gestureId,
    demonstrationBars,
    handoverStartBarOffsetMs,
    onPreparationBar,
    onHandoverStart,
    onAttemptStart,
  }: GuidedGesturePreparationOptions): Promise<StoryGestureResult> => {
    pauseGuidedMovementRecognition();
    store.setMapCameraMode(getMigrationMapCameraModeForGesture(gestureId));
    const currentTransportMs = audioStore.getBaseRhythmTransportTimeMs();
    const countdownStartTransportMs = resolveNextGuidedBarBoundary(
      currentTransportMs,
      audioStore.getBeatDurationMs(),
      true,
    );
    void scheduleOwnerSwitch(
      gestureId,
      countdownStartTransportMs,
      `gesture-preparation:${gestureId}`,
    );
    const practice = gestures.start(gestureId, {
      countdownStartTransportMs,
      preparationBars: Math.max(0, Math.round(demonstrationBars)),
      handoverStartBarOffsetMs,
      onPreparationBar,
      onHandoverStart,
      onAttemptStart,
    });
    scheduleFrame();
    return await practice;
  };

  const startGuidedGesturePractice = async (
    gestureId: StoryGestureId,
    options: GuidedGesturePracticeOptions = {},
  ): Promise<StoryGestureResult> => {
    pauseGuidedMovementRecognition();
    store.setMapCameraMode(getMigrationMapCameraModeForGesture(gestureId));
    const currentTransportMs = audioStore.getBaseRhythmTransportTimeMs();
    const countdownStartTransportMs = resolveNextGuidedBarBoundary(
      currentTransportMs,
      audioStore.getBeatDurationMs(),
      true,
    );
    void scheduleOwnerSwitch(
      gestureId,
      countdownStartTransportMs,
      `gesture-countdown:${gestureId}`,
    );
    const practice = gestures.start(gestureId, {
      countdownStartTransportMs,
      preparationBars: 0,
      ...options,
    });
    scheduleFrame();
    return await practice;
  };

  const playGuidedStoryTransition = async ({
    targetElapsedMs,
    durationMs,
    movement: transitionMovement,
    onBar,
  }: {
    targetElapsedMs: number;
    durationMs: number;
    movement?: ResolvedMigrationMovement | null;
    onBar?: (index: number) => void;
  }) => {
    cancelGuidedStoryTransition();
    store.setMapCameraMode(
      getMigrationMapCameraModeForMovement(transitionMovement),
    );
    if (
      transitionMovement &&
      tutorialMovement?.movementId !== transitionMovement.movementId
    ) {
      await startTutorialPlayback(transitionMovement, "story");
    } else if (transitionMovement) {
      continueTutorialMovement();
    } else {
      stopTutorialMovement();
    }
    if (!guidedInterludeActive.value) return;

    guidedTransitionStartElapsedMs = store.currentElapsedMs;
    guidedTransitionTargetElapsedMs = Math.max(
      guidedTransitionStartElapsedMs,
      targetElapsedMs,
    );
    guidedTransitionStartTransportMs =
      audioStore.getBaseRhythmTransportTimeMs();
    const transitionBoundaryMs = resolveNextGuidedBarBoundary(
      guidedTransitionStartTransportMs + Math.max(1, durationMs),
      audioStore.getBeatDurationMs(),
      true,
    );
    guidedTransitionDurationMs = Math.max(
      1,
      transitionBoundaryMs - guidedTransitionStartTransportMs,
    );
    guidedTransitionBarIndex = 0;
    onGuidedTransitionBar = onBar ?? null;
    onGuidedTransitionBar?.(0);
    guidedStoryTransitionActive.value = true;
    scheduleFrame();

    return new Promise<void>((resolve) => {
      guidedTransitionResolver = resolve;
    });
  };

  const waitForGuidedBars = (bars = 1) => {
    if (!guidedInterludeActive.value || disposed) return Promise.resolve();

    const barCount = Math.max(1, Math.round(bars));
    const currentTransportMs = audioStore.getBaseRhythmTransportTimeMs();
    const barDurationMs =
      audioStore.getBeatDurationMs() *
      MIGRATION_RECOGNITION_THRESHOLDS.beatsPerBar;
    const targetTransportMs = resolveNextGuidedBarBoundary(
      currentTransportMs + barDurationMs * barCount,
      audioStore.getBeatDurationMs(),
      true,
    );

    if (currentTransportMs >= targetTransportMs) return Promise.resolve();

    scheduleFrame();
    return new Promise<void>((resolve) => {
      guidedBarWaits.push({ targetTransportMs, resolve });
    });
  };

  const waitForGuidedBeats = (beats = 1) => {
    if (!guidedInterludeActive.value || disposed) return Promise.resolve();

    const beatCount = Math.max(1, Math.round(beats));
    const currentTransportMs = audioStore.getBaseRhythmTransportTimeMs();
    const beatDurationMs = audioStore.getBeatDurationMs();
    const targetTransportMs = currentTransportMs + beatDurationMs * beatCount;

    scheduleFrame();
    return new Promise<void>((resolve) => {
      guidedBarWaits.push({ targetTransportMs, resolve });
    });
  };

  const leaveGuidedInterlude = async () => {
    if (!guidedInterludeActive.value) return;

    guidedInterludeRevision++;
    cancelGuidedStoryTransition();
    cancelGuidedBarWaits();
    gestures.cancel();
    stopTutorialMovement();
    guidedInterludeActive.value = false;
    gestures.setNarrationEnabled?.(true);
    store.removePauseReason("tutorial");

    if (hasBlockingPause(store.pauseReasons)) {
      store.setPlaybackState("paused");
      return;
    }

    store.setPlaybackState("playing");
    await startMovementForCurrentPhase();
    await synchronizeAudioForPauseReasons();
    lastFrameAtMs = null;
    scheduleFrame();
  };

  const cancelGuidedInterlude = () => {
    guidedInterludeRevision++;
    cancelScheduledOwnerSwitch();
    cancelGuidedStoryTransition();
    cancelGuidedBarWaits();
    gestures.cancel();
    stopTutorialMovement();
    guidedInterludeActive.value = false;
    gestures.setNarrationEnabled?.(true);
    avatarPlaybackOwner.value = "idle";
    store.removePauseReason("tutorial");
  };

  const completeGuidedInterlude = () => {
    cancelGuidedStoryTransition();
    cancelGuidedBarWaits();
    movement.tick(0);
    movement.pause();
    pauseGuidedMovementRecognition();
    audioStore.stopBaseRhythmLoop();
    seasonAudio.fadeOutForCycle(2);
    tutorialPlaybackMode.value = null;
    tutorialMovement = null;
    tutorialPlaybackStartTransportMs = null;
    avatarPlaybackOwner.value = "idle";
    store.setPlaybackState("completed");
  };

  const warnEventMismatch = (event: MigrationActEvent) => {
    if (!import.meta.dev) return;

    if (store.currentDate !== event.boundaryDate) {
      console.warn("[MigrationAct] Event date does not match story date.", {
        event: event.eventType,
        eventDate: event.boundaryDate,
        currentDate: store.currentDate,
      });
    }
    if (store.lastMapFrame && store.lastMapFrame.date !== event.boundaryDate) {
      console.warn("[MigrationAct] Event date does not match map point.", {
        event: event.eventType,
        eventDate: event.boundaryDate,
        mapDate: store.lastMapFrame.date,
      });
    }
  };

  const completeGestureEvent = async (
    event: MigrationActEvent,
    currentRunId: number,
    resultPromise: ReturnType<MigrationActGestureService["start"]>,
  ) => {
    const loadTiming = gestures.loadTimings.get(event.gestureId);
    let completed = false;

    try {
      const result = await resultPromise;
      if (!isCurrentRun(currentRunId)) return;
      completed = result === "completed";

      store.setEventStatus(event.id, completed ? "completed" : "skipped");
      store.updateDiagnostic(event.id, {
        movementLoadStart: loadTiming?.start ?? null,
        movementLoadEnd: loadTiming?.end ?? null,
        gestureCompleted: clock.now(),
      });
    } catch (error) {
      if (!isCurrentRun(currentRunId)) return;
      store.setEventStatus(event.id, "skipped");
      console.error("[MigrationAct] Gesture failed.", error);
    } finally {
      if (isCurrentRun(currentRunId)) {
        store.setActiveEvent(null);
        store.removePauseReason("gesture");
        store.updateDiagnostic(event.id, {
          storyResumed: hasBlockingPause(store.pauseReasons)
            ? null
            : clock.now(),
        });

        if (hasBlockingPause(store.pauseReasons)) {
          store.setPlaybackState("paused");
          cancelFrame();
          await synchronizeAudioForPauseReasons();
        } else {
          store.setPlaybackState("playing");
          synchronizeSeasonForCurrentDate();
          if (completed && event.gestureId === "arrival") {
            store.setMapCameraMode("residence");
            const cueIds = getMigrationChangeFlowArrivalCueIds(
              event.cycleId,
              event.eventType,
            );
            const storyCueIds = toStoryNarrationCueIds(cueIds);
            if (
              event.eventType === "spring_arrival" &&
              shouldUseFinalResidenceSummary()
            ) {
              scheduleFinalResidenceSummary(currentRunId, storyCueIds);
            } else if (storyCueIds.length) {
              scheduleStoryNarrationSequence(
                storyCueIds,
                getNarrationBasePayload(
                  event.eventType === "autumn_arrival"
                    ? "winterReflection"
                    : "breedingReflection",
                ),
                currentRunId,
                audioStore.getBeatDurationMs() *
                  MIGRATION_RECOGNITION_THRESHOLDS.beatsPerBar,
              );
            }
          }
          void startMovementForCurrentPhase();
          await synchronizeAudioForPauseReasons();
          lastFrameAtMs = null;
          scheduleFrame();
        }
      }
    }
  };

  const triggerEvent = (
    event: MigrationActEvent,
    detectedElapsedMs: number,
  ) => {
    const currentRunId = runId;
    const previousElapsedMs = store.currentElapsedMs;

    movement.pause();
    movementRecognition.pause();
    clearMovementFeedback();
    store.setElapsedMs(event.boundaryTimeMs);
    selectMovementForCurrentPhase();
    prepareRecognitionForCurrentPhase();
    store.setMapCameraMode(getMigrationMapCameraModeForEvent(event.eventType));
    if (event.gestureId === "departure") {
      const arrivalEventType =
        event.eventType === "autumn_departure"
          ? "autumn_arrival"
          : "spring_arrival";
      const arrival =
        store.events.find((item) => item.eventType === arrivalEventType) ??
        null;

      const cueId = getMigrationChangeFlowDepartureCueId(
        event.cycleId,
        event.eventType,
      );
      if (cueId) {
        const storyCueId = toStoryNarrationCueId(cueId);
        const cue = resolveMigrationActStoryNarrationCue(storyCueId);
        const payload = getMigrationEventPayload(
          event.eventType === "autumn_departure"
            ? "autumnDeparturePrepare"
            : "springDeparturePrepare",
          event,
          arrival,
          event.eventType === "autumn_departure" ? "south" : "north",
          { cueId: cue.id, cueRole: cue.role },
        );
        void playStoryNarrationCue(storyCueId, payload, {
          behavior: "replace",
        });
      }
    }
    store.setEventStatus(event.id, "triggered");
    store.setActiveEvent(event.id);
    store.addPauseReason("gesture");
    store.setPlaybackState("gesture_lead_in");
    switchAvatarOwnerNow(event.gestureId, `gesture-event:${event.gestureId}`);
    store.addDiagnostic({
      eventId: event.id,
      actId: store.actId ?? surfaceId,
      playbackMode: store.playbackMode,
      cycleId: event.cycleId,
      eventType: event.eventType,
      eventDate: event.boundaryDate,
      boundaryTimeMs: event.boundaryTimeMs,
      previousElapsedMs,
      detectedElapsedMs,
      detectionLatencyMs: Math.max(0, detectedElapsedMs - event.boundaryTimeMs),
      pausedElapsedMs: store.currentElapsedMs,
      pausedDate: store.currentDate,
      movementLoadStart: null,
      movementLoadEnd: null,
      leadInStart: clock.now(),
      movementFirstFrame: null,
      gestureCompleted: null,
      storyResumed: null,
      selectedMapPointDate: store.lastMapFrame?.date ?? null,
    });
    // UX invariant:
    // Story-Time freezes at the real data event. Countdown starts only on the
    // next global bar; do not run Story-Time through Departure or Arrival prep.
    const resultPromise = gestures.start(event.gestureId, {
      countdownStartTransportMs: resolveNextGuidedBarBoundary(
        audioStore.getBaseRhythmTransportTimeMs(),
        audioStore.getBeatDurationMs(),
        true,
      ),
      autoProgressEnabled: isAutoProgressEnabled,
    });
    void completeGestureEvent(event, currentRunId, resultPromise);
  };

  const enterCycleTransition = async () => {
    const cycleRun = store.activeCycleRun;
    if (!cycleRun) return;

    store.markCycleCompleted(cycleRun.id);

    const hasNextCycle =
      store.playbackMode === "story" &&
      store.activeCycleIndex < store.cycleRuns.length - 1;

    if (!hasNextCycle) {
      const currentRunId = runId;
      store.setPlaybackState("completed");
      movement.stop();
      movementRecognition.reset();
      seasonAudio.fadeOutForCycle(2);
      cancelFrame();
      if (finalResidenceSummaryPromise) {
        await finalResidenceSummaryPromise;
      } else {
        await playStoryNarrationSequence(
          toStoryNarrationCueIds(getMigrationChangeFlowCompletionCueIds()),
          getNarrationBasePayload("actSummary"),
          currentRunId,
        );
      }
      if (!isCurrentRun(currentRunId)) return;
      audioStore.fadeOutBaseRhythmLoop(
        (audioStore.getBeatDurationMs() *
          MIGRATION_RECOGNITION_THRESHOLDS.beatsPerBar *
          2) /
          1_000,
      );
      if (act) storyRuntimeStore.completeAct();
      return;
    }

    const nextIndex = store.activeCycleIndex + 1;
    const nextCycleRun = store.cycleRuns[nextIndex];
    if (!nextCycleRun) return;
    const transitionDurationMs =
      audioStore.getBeatDurationMs() *
      MIGRATION_RECOGNITION_THRESHOLDS.beatsPerBar;
    const coverStartedTransportMs = audioStore.getBaseRhythmTransportTimeMs();

    movementRecognition.pause();
    // UX invariant:
    // The parent-owned map cover stays mounted for the complete transition bar,
    // independent of how quickly the next dataset and marker become ready.
    store.showCycleTransitionOverlay({
      fromTitle: getCycleLabel(cycleRun),
      toTitle: getCycleLabel(nextCycleRun),
      sourceCycleId: cycleRun.cycleId,
      targetCycleId: nextCycleRun.cycleId,
      targetDate: `${nextCycleRun.cycleStartYear}-06-01`,
      targetPhase: "summer_rest",
      durationMs: transitionDurationMs,
      coverStartedTransportMs,
    });
    store.hideCycleOverlay();
    store.setTransitionRemainingMs(transitionDurationMs);
    store.setPlaybackState("cycle_transition");
    cycleTransitionStartedAtTransportMs = coverStartedTransportMs;
    cycleTransitionTargetIndex = nextIndex;

    store.setCycleTransitionState("swapping", coverStartedTransportMs);
    prepareCycle(nextIndex, { preserveMovement: true });
    suppressNextCycleIntro = true;
    const cueId = getMigrationChangeFlowTransitionCueId(nextCycleRun.cycleId);
    if (cueId) {
      const storyCueId = toStoryNarrationCueId(cueId);
      const cue = resolveMigrationActStoryNarrationCue(storyCueId);
      void playStoryNarrationCue(
        storyCueId,
        getNarrationBasePayload("cycleTransition", {
          cueId: cue.id,
          cueRole: cue.role,
        }),
      );
    }

    if (hasBlockingPause(store.pauseReasons)) {
      store.setPlaybackState("paused");
      return;
    }

    await audioStore.resumeBaseRhythmLoop();
    lastFrameAtMs = null;
    scheduleFrame();
  };

  const finishCycleTransition = async () => {
    if (cycleTransitionTargetIndex === null) return;
    if (!isCycleTransitionMapReady()) return;

    const revealTransportMs = audioStore.getBaseRhythmTransportTimeMs();
    store.setCycleTransitionState("revealing", revealTransportMs);
    cycleTransitionStartedAtTransportMs = null;
    cycleTransitionTargetIndex = null;
    store.hideCycleTransitionOverlay(revealTransportMs);
    store.setTransitionRemainingMs(0);

    if (hasBlockingPause(store.pauseReasons)) {
      store.setPlaybackState("paused");
      return;
    }

    store.setPlaybackState("playing");
    startActiveCycleOrientation({
      suppressNarration: suppressNextCycleIntro,
      suppressOverlay: suppressNextCycleIntro,
    });
    suppressNextCycleIntro = false;
    void startMovementForCurrentPhase();
    await audioStore.resumeBaseRhythmLoop();
    await seasonAudio.start(store.currentDate);
    lastFrameAtMs = null;
  };

  function tick(nowMs: number) {
    animationFrameId = 0;
    if (disposed) return;

    const deltaMs =
      lastFrameAtMs === null ? 0 : Math.max(0, nowMs - lastFrameAtMs);
    lastFrameAtMs = nowMs;
    if (store.playbackState === "playing") store.tickCycleOverlay(deltaMs);

    if (
      movementFeedbackExpiresAtMs !== null &&
      audioStore.getBaseRhythmTransportTimeMs() >= movementFeedbackExpiresAtMs
    ) {
      clearMovementFeedback();
    }
    if (store.playbackState === "playing") playDueStoryNarrationSequences();

    if (guidedInterludeActive.value) {
      const transportTimeMs = audioStore.getBaseRhythmTransportTimeMs();
      if (
        scheduledNextOwner.value &&
        scheduledOwnerSwitchMs.value !== null &&
        transportTimeMs >= scheduledOwnerSwitchMs.value
      ) {
        commitOwnerSwitch(
          scheduledNextOwner.value,
          scheduledOwnerSwitchMs.value,
          lastOwnerSwitchReason.value ?? "scheduled-owner-switch",
        );
      }
      if (gestures.store.isActive || gestures.demonstrationActive.value) {
        gestures.tick();
      }

      if (
        guidedStoryTransitionActive.value &&
        store.playbackState === "playing" &&
        !hasBlockingPause(store.pauseReasons)
      ) {
        const previousDate = store.currentDate;
        const transitionElapsedMs = Math.max(
          0,
          audioStore.getBaseRhythmTransportTimeMs() -
            guidedTransitionStartTransportMs,
        );
        const progress = Math.min(
          transitionElapsedMs / guidedTransitionDurationMs,
          1,
        );
        const barDurationMs = audioStore.getBeatDurationMs() * 4;
        const nextBarIndex = Math.floor(transitionElapsedMs / barDurationMs);
        while (guidedTransitionBarIndex < nextBarIndex) {
          guidedTransitionBarIndex++;
          onGuidedTransitionBar?.(guidedTransitionBarIndex);
        }
        store.setElapsedMs(
          guidedTransitionStartElapsedMs +
            (guidedTransitionTargetElapsedMs - guidedTransitionStartElapsedMs) *
              progress,
        );
        if (store.currentDate !== previousDate)
          synchronizeSeasonForCurrentDate();
        if (progress >= 1) {
          store.setElapsedMs(guidedTransitionTargetElapsedMs);
          guidedStoryTransitionActive.value = false;
          onGuidedTransitionBar = null;
          const resolve = guidedTransitionResolver;
          guidedTransitionResolver = null;
          resolve?.();
        }
      }
      resolveGuidedBarWaits();

      if (
        store.playbackState === "playing" &&
        !hasBlockingPause(store.pauseReasons) &&
        tutorialMovement &&
        tutorialPlaybackStartTransportMs !== null
      ) {
        const tutorialElapsedMs = Math.max(
          0,
          resolveGuidedMovementSourceTime({
            transportMs: audioStore.getBaseRhythmTransportTimeMs(),
            ownerStartedAtMs:
              tutorialPlaybackStartTransportMs +
              tutorialMovement.playbackTiming.prerollMs,
            prerollMs: tutorialMovement.playbackTiming.prerollMs,
          }),
        );
        movement.tick(tutorialElapsedMs);

        if (tutorialPlaybackMode.value === "demonstration") {
          const movementElapsedMs = Math.max(
            0,
            tutorialElapsedMs - tutorialMovement.playbackTiming.prerollMs,
          );
          const barDurationMs =
            audioStore.getBeatDurationMs() *
            MIGRATION_RECOGNITION_THRESHOLDS.beatsPerBar;
          const repetitionIndex = Math.min(
            Math.floor(movementElapsedMs / barDurationMs) + 1,
            tutorialDemonstrationRepetitions,
          );
          if (repetitionIndex !== tutorialRepetitionIndex.value) {
            tutorialRepetitionIndex.value = repetitionIndex;
            onTutorialRepetition?.(repetitionIndex);
          }

          if (tutorialElapsedMs >= tutorialDemonstrationDurationMs) {
            if (tutorialDemonstrationHandsOffToPractice) {
              tutorialPlaybackMode.value = "practice";
              startGuidedMovementRecognition("practice-gating");
            } else {
              movement.pause();
              tutorialPlaybackMode.value = null;
              tutorialPlaybackStartTransportMs = null;
              pauseGuidedMovementRecognition();
            }
            tutorialDemonstrationHandsOffToPractice = false;
            const resolveDemonstration = tutorialDemonstrationResolver;
            tutorialDemonstrationResolver = null;
            resolveDemonstration?.();
          }
        }
      }

      if (store.playbackState === "playing") scheduleFrame();
      return;
    }

    if (store.playbackState === "initial_countdown") {
      const transportTimeMs = audioStore.getBaseRhythmTransportTimeMs();
      const beatDurationMs = audioStore.getBeatDurationMs();
      const elapsedMs = Math.max(
        0,
        transportTimeMs - (initialCountdownStartTransportMs ?? transportTimeMs),
      );
      const previewDurationMs = beatDurationMs * 3;
      const countdownDurationMs = beatDurationMs * 4;
      const movementElapsedMs =
        elapsedMs >= previewDurationMs
          ? elapsedMs - previewDurationMs
          : elapsedMs % countdownDurationMs;

      movement.tick(movementElapsedMs);
      store.setInitialCountdownNumber(
        Math.max(
          1,
          Math.ceil((countdownDurationMs - elapsedMs) / beatDurationMs),
        ),
      );

      if (elapsedMs >= countdownDurationMs) {
        store.setInitialCountdownNumber(null);
        store.setPlaybackState("playing");
        initialCountdownStartTransportMs = null;
        startActiveCycleOrientation();
        void startMovementForCurrentPhase();
      }
    } else if (store.playbackState === "playing") {
      if (hasBlockingPause(store.pauseReasons)) {
        store.setPlaybackState("paused");
      } else {
        if (gestures.store.isActive) gestures.tick();
        const previousElapsedMs = store.currentElapsedMs;
        const advance = getMigrationPlaybackAdvance({
          timeline: store.timeline,
          events: store.events,
          previousElapsedMs,
          deltaMs,
        });
        const event = advance.crossedEvent;

        if (event) {
          triggerEvent(event, advance.detectedElapsedMs);
        } else {
          const previousDate = store.currentDate;
          const previousPhase = store.currentPhase;
          store.setElapsedMs(advance.elapsedMs);
          if (store.currentDate !== previousDate) {
            synchronizeSeasonForCurrentDate();
          }
          if (store.currentPhase !== previousPhase) {
            void startMovementForCurrentPhase();
          } else {
            movement.tick(getTransportMovementElapsedMs());
          }
          updateUpcomingGestureCameraWindow();
          playScheduledResidenceNarration(
            previousElapsedMs,
            store.currentElapsedMs,
          );
          if (advance.completed) {
            void enterCycleTransition();
          }
        }
      }
    } else if (store.playbackState === "cycle_transition") {
      if (!hasBlockingPause(store.pauseReasons)) {
        const transitionElapsedMs =
          cycleTransitionStartedAtTransportMs === null
            ? 0
            : Math.max(
                0,
                audioStore.getBaseRhythmTransportTimeMs() -
                  cycleTransitionStartedAtTransportMs,
              );
        const durationMs =
          audioStore.getBeatDurationMs() *
          MIGRATION_RECOGNITION_THRESHOLDS.beatsPerBar;
        store.setTransitionRemainingMs(
          Math.max(0, durationMs - transitionElapsedMs),
        );
        store.tickCycleTransitionOverlay(deltaMs);
        movement.tick(getTransportMovementElapsedMs());
        // UX invariant:
        // Transition reveal is transport-owned. Fast map readiness cannot end
        // the cover before one bar, and late readiness waits for Bar 1.
        if (isCycleTransitionRevealBoundaryReady(transitionElapsedMs)) {
          void finishCycleTransition();
        }
      }
    } else if (
      store.playbackState === "gesture_lead_in" ||
      store.playbackState === "gesture_playing"
    ) {
      // UX invariant:
      // Departure and Arrival gestures own avatar time only; Story-Time stays
      // pinned to the exact data event until the gesture handoff completes.
      const frozenElapsedMs = store.currentElapsedMs;
      gestures.tick();
      const diagnostic = store.diagnostics.find(
        (item) => item.eventId === store.activeEventId,
      );
      if (
        diagnostic &&
        diagnostic.movementFirstFrame === null &&
        gestures.store.currentSourceTimeMs > 0
      ) {
        store.updateDiagnostic(diagnostic.eventId, {
          movementFirstFrame: clock.now(),
        });
      }
      store.setPlaybackState(
        gestures.store.state === "waiting-for-lead-in" ||
          gestures.store.state === "loading-movement"
          ? "gesture_lead_in"
          : "gesture_playing",
      );

      if (store.currentElapsedMs !== frozenElapsedMs && import.meta.dev) {
        console.warn("[MigrationAct] Story advanced during a gesture.");
        store.setElapsedMs(frozenElapsedMs);
      }
    }

    if (
      store.playbackState === "playing" ||
      store.playbackState === "initial_countdown" ||
      store.playbackState === "gesture_lead_in" ||
      store.playbackState === "gesture_playing" ||
      store.playbackState === "cycle_transition"
    ) {
      scheduleFrame();
    }
  }

  const initialize = async () => {
    const currentRunId = nextRunId();

    disposed = false;
    cancelFrame();
    store.prepare({ actId: surfaceId, cycleRuns });
    prepareCycle(0);
    store.setPlaybackState("idle");
    installDebugUtility();
    if (act) storyEngine.prepareAct(act.id);

    try {
      await Promise.all([
        gestures.preload(),
        movement.preloadAll(),
        seasonAudio.preload(),
      ]);
      if (!isCurrentRun(currentRunId)) return;
      initialized = true;
    } catch (error) {
      if (!isCurrentRun(currentRunId)) return;
      store.setError(getErrorMessage(error));
    }

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }
  };

  const resetForMode = (mode: "story" | "single_cycle", index: number) => {
    nextRunId();
    cancelFrame();
    cancelGuidedInterlude();
    gestures.cancel();
    pendingStoryNarrationSequences = [];
    resetFinalResidenceSummaryState();
    cycleTransitionStartedAtTransportMs = null;
    cycleTransitionTargetIndex = null;
    suppressNextCycleIntro = false;
    residenceNarrationSchedule = [];
    handledResidenceNarrationCueIds = new Set();
    resetAuthoredNarrationState();
    initialCountdownStartTransportMs = null;
    phaseMovementScheduledStartTransportMs = null;
    movement.reset();
    movementRecognition.reset();
    narration.stop();
    clearMovementFeedback();
    handledMovementFeedbackId = null;
    seasonAudio.reset();
    audioStore.stopBaseRhythmLoop();
    store.prepare({ actId: surfaceId, cycleRuns });
    store.setPlaybackMode(mode);
    prepareCycle(index);
    store.clearPauseReasons();
  };

  const startAtIndex = async (
    mode: "story" | "single_cycle",
    index: number,
  ) => {
    if (!initialized) {
      await Promise.all([
        gestures.preload(),
        movement.preloadAll(),
        seasonAudio.preload(),
      ]);
      initialized = true;
    }
    resetForMode(mode, index);
    if (act) storyEngine.startAct(act.id);
    const currentRunId = runId;
    if (mode === "story" && index === 0) {
      await playStoryNarrationSequence(
        toStoryNarrationCueIds(getMigrationChangeFlowIntroCueIds()),
        getNarrationBasePayload("flowIntro"),
        currentRunId,
      );
      if (!isCurrentRun(currentRunId)) return;
    }
    await audioStore.startBaseRhythmLoop(0);
    await seasonAudio.start(store.currentDate);
    const resolved = selectMovementForCurrentPhase();
    prepareRecognitionForCurrentPhase();
    if (resolved) await movement.start(resolved, 0);
    initialCountdownStartTransportMs =
      audioStore.getBaseRhythmTransportTimeMs();
    store.setInitialCountdownNumber(4);
    store.setPlaybackState("initial_countdown");
    lastFrameAtMs = null;
    scheduleFrame();
  };

  const startStory = () => startAtIndex("story", 0);

  const startSingleCycle = (cycleRunId: string) => {
    const index = cycleRuns.findIndex((cycle) => cycle.id === cycleRunId);
    if (index < 0) throw new Error(`Unknown cycle run "${cycleRunId}".`);
    return startAtIndex("single_cycle", index);
  };

  const toggleDebug = () => {
    store.setDebugEnabled(!store.debug.enabled);
  };

  const toggleAutoProgress = () => {
    store.setAutoProgressEnabled(!store.debug.autoProgressEnabled);
  };

  const pause = () => {
    if (
      store.playbackState === "initial_countdown" ||
      store.playbackState === "playing"
    ) {
      pausedFromState = store.playbackState;
    }
    store.addPauseReason("user");
    if (!store.isGestureActive && store.playbackState !== "cycle_transition") {
      store.setPlaybackState("paused");
      cancelFrame();
      storyEngine.pauseStory();
    } else if (store.playbackState === "cycle_transition") {
      cancelFrame();
    }
    movement.pause();
    movementRecognition.pause();
    void synchronizeAudioForPauseReasons();
  };

  const resume = async () => {
    store.removePauseReason("user");
    if (guidedInterludeActive.value) {
      if (hasBlockingPause(store.pauseReasons)) return;

      store.setPlaybackState("playing");
      await synchronizeAudioForPauseReasons();
      movement.resume(movement.movementSourceTimeMs.value);
      if (tutorialPlaybackMode.value && tutorialMovement) {
        startGuidedMovementRecognition(
          tutorialPlaybackMode.value === "practice"
            ? "practice-gating"
            : "passive-feedback",
        );
      }
      lastFrameAtMs = null;
      scheduleFrame();
      pausedFromState = null;
      return;
    }
    if (store.isGestureActive) {
      await synchronizeAudioForPauseReasons();
      return;
    }
    if (store.playbackState === "cycle_transition") {
      await synchronizeAudioForPauseReasons();
      lastFrameAtMs = null;
      scheduleFrame();
      return;
    }
    if (
      store.playbackState !== "paused" ||
      hasBlockingPause(store.pauseReasons)
    ) {
      return;
    }

    if (pausedFromState === "initial_countdown") {
      store.setPlaybackState("initial_countdown");
      storyEngine.resumeStory();
      await synchronizeAudioForPauseReasons();
      movement.resume(0);
      pausedFromState = null;
      lastFrameAtMs = null;
      scheduleFrame();
      return;
    }

    if (gestures.store.isActive) {
      store.setPlaybackState("playing");
      storyEngine.resumeStory();
      await synchronizeAudioForPauseReasons();
      pausedFromState = null;
      lastFrameAtMs = null;
      scheduleFrame();
      return;
    }

    store.setPlaybackState("playing");
    void startMovementForCurrentPhase();
    storyEngine.resumeStory();
    lastFrameAtMs = null;
    scheduleFrame();
    await synchronizeAudioForPauseReasons();
    pausedFromState = null;
  };

  const reset = async () => {
    nextRunId();
    cancelFrame();
    cancelGuidedInterlude();
    gestures.cancel();
    pendingStoryNarrationSequences = [];
    resetFinalResidenceSummaryState();
    cycleTransitionStartedAtTransportMs = null;
    cycleTransitionTargetIndex = null;
    suppressNextCycleIntro = false;
    residenceNarrationSchedule = [];
    handledResidenceNarrationCueIds = new Set();
    resetAuthoredNarrationState();
    initialCountdownStartTransportMs = null;
    phaseMovementScheduledStartTransportMs = null;
    movement.reset();
    movementRecognition.reset();
    narration.stop();
    clearMovementFeedback();
    handledMovementFeedbackId = null;
    seasonAudio.reset();
    audioStore.stopBaseRhythmLoop();
    store.prepare({ actId: surfaceId, cycleRuns });
    prepareCycle(0);
    store.setPlaybackState("idle");
    if (act) storyEngine.prepareAct(act.id);
    try {
      await Promise.all([
        gestures.preload(),
        movement.preloadAll(),
        seasonAudio.preload(),
      ]);
      initialized = true;
    } catch (error) {
      store.setError(getErrorMessage(error));
    }
  };

  const seekToElapsedMs = async (elapsedMs: number) => {
    const wasPlaying = store.playbackState === "playing";

    nextRunId();
    gestures.cancel();
    pendingStoryNarrationSequences = [];
    resetFinalResidenceSummaryState();
    cycleTransitionStartedAtTransportMs = null;
    cycleTransitionTargetIndex = null;
    suppressNextCycleIntro = false;
    handledResidenceNarrationCueIds = new Set();
    resetAuthoredNarrationState();
    phaseMovementScheduledStartTransportMs = null;
    movementRecognition.pause();
    store.setActiveEvent(null);
    store.removePauseReason("gesture");
    store.setElapsedMs(elapsedMs);
    store.setMapCameraMode(
      getMigrationMapCameraModeForPhase(store.currentPhase),
    );
    resetContinuousPhaseEngagement();
    store.replaceEvents(
      reconcileMigrationActEventsForSeek(store.events, store.currentElapsedMs),
    );
    store.seekRevision++;

    if (wasPlaying) void startMovementForCurrentPhase();
    else {
      selectMovementForCurrentPhase();
      prepareRecognitionForCurrentPhase();
    }

    await seasonAudio.seek(store.currentDate);

    if (wasPlaying) {
      lastFrameAtMs = null;
      scheduleFrame();
    }
  };

  const selectCycle = (cycleId: string) => {
    const index = store.cycleRuns.findIndex(
      (cycle) => cycle.cycleId === cycleId,
    );
    if (index < 0) return;

    resetForMode("single_cycle", index);
    store.setPlaybackState("idle");
  };

  const startManualGesture = async (gestureId: "departure" | "arrival") => {
    if (store.playbackState === "playing" || store.isGestureActive) return;

    movement.pause();
    movementRecognition.pause();
    store.addPauseReason("gesture");
    store.setPlaybackState("gesture_lead_in");
    scheduleFrame();
    await gestures.start(gestureId);
    store.removePauseReason("gesture");
    store.setPlaybackState(store.hasUserPause ? "paused" : "idle");
    await synchronizeAudioForPauseReasons();
  };

  const handlePoseFrame = (landmarks: PoseLandmarkLike[] | null) => {
    if (hasBlockingPause(store.pauseReasons)) return;
    gestures.handlePoseFrame(landmarks);
    if (store.playbackState === "playing" && !store.isGestureActive) {
      movementRecognition.handlePoseFrame({
        landmarks,
        transportTimeMs: audioStore.getBaseRhythmTransportTimeMs(),
      });
      handleContinuousEngagementEvaluation();
      const evaluationId = movementRecognition.lastSuccessfulEvaluationId.value;
      if (evaluationId) showMovementSuccessFeedback(evaluationId);
    }
  };

  const forceCompleteGuidedRecognition = () => {
    clearMovementFeedback();
    movementRecognition.reset();
    return gestures.forceComplete();
  };

  const reportMapFrame = (frame: MigrationActMapFrame) => {
    store.reportMapFrame(frame);
    const transition = store.cycleTransitionOverlay;
    const cameraReady = frame.cameraReady ?? true;
    const expectedFrame = getCurrentMapFrame();
    if (
      transition.visible &&
      transition.state === "swapping" &&
      frame.cycleId === transition.targetCycleId &&
      frame.date === transition.targetDate &&
      frame.phase === transition.targetPhase &&
      cameraReady &&
      expectedFrame?.cycleId === transition.targetCycleId &&
      expectedFrame.date === transition.targetDate &&
      expectedFrame.phase === transition.targetPhase &&
      areLatLngEqual(frame.markerLatLng, expectedFrame.markerLatLng)
    ) {
      store.markCycleTransitionMapReady({
        markerLatLng: frame.markerLatLng ?? null,
        cameraReady,
        transportMs: audioStore.getBaseRhythmTransportTimeMs(),
      });
    }
    const event = activeEvent.value;
    if (event) {
      store.updateDiagnostic(event.id, { selectedMapPointDate: frame.date });
      warnEventMismatch(event);
    }
  };

  const getCurrentMapFrame = () => {
    const cycleId = store.activeCycleId;
    if (!cycleId) return null;

    return getMigrationMapFrame(
      cycleId,
      store.timeline,
      getMigrationStoryCyclePoints(cycleId),
      store.currentElapsedMs,
    );
  };

  function handleVisibilityChange() {
    if (document.visibilityState === "hidden") {
      store.addPauseReason("system");
      void synchronizeAudioForPauseReasons();
      cancelFrame();
      movement.pause();
      movementRecognition.pause();
      if (store.playbackState === "playing") store.setPlaybackState("paused");
      return;
    }

    store.removePauseReason("system");
    lastFrameAtMs = null;
    if (store.isGestureActive) {
      void synchronizeAudioForPauseReasons();
      scheduleFrame();
    } else if (store.playbackState === "paused" && !store.hasUserPause) {
      void resume();
    } else if (store.playbackState === "cycle_transition") {
      scheduleFrame();
    }
  }

  const dispose = () => {
    disposed = true;
    nextRunId();
    cancelFrame();
    cancelGuidedInterlude();
    gestures.cleanup();
    pendingStoryNarrationSequences = [];
    resetFinalResidenceSummaryState();
    cycleTransitionStartedAtTransportMs = null;
    cycleTransitionTargetIndex = null;
    suppressNextCycleIntro = false;
    residenceNarrationSchedule = [];
    handledResidenceNarrationCueIds = new Set();
    resetAuthoredNarrationState();
    initialCountdownStartTransportMs = null;
    phaseMovementScheduledStartTransportMs = null;
    movement.cleanup();
    movementRecognition.cleanup();
    narration.stop();
    clearMovementFeedback();
    seasonAudio.dispose();
    audioStore.stopBaseRhythmLoop();
    storyEngine.stopStoryEngine();
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    }
    store.dispose();
  };

  return {
    store,
    gestures,
    movement,
    movementRecognition,
    seasonAudio,
    guidedInterludeActive,
    guidedStoryTransitionActive,
    tutorialPlaybackMode,
    guidedRecognitionPurpose,
    tutorialRepetitionIndex,
    avatarPlaybackOwner,
    scheduledNextOwner,
    scheduledOwnerSwitchMs,
    lastOwnerSwitchReason,
    ownerSwitchTrace,
    instructorFrame,
    instructorSourceAspect,
    guidedTrace,
    activeEvent,
    movementPhaseTiming,
    migrationPhaseDurationSeconds,
    debugSnapshot,
    initialize,
    startStory,
    startSingleCycle,
    toggleDebug,
    toggleAutoProgress,
    pause,
    resume,
    reset,
    seekToElapsedMs,
    selectCycle,
    startManualGesture,
    enterGuidedInterlude,
    leaveGuidedInterlude,
    cancelGuidedInterlude,
    playTutorialDemonstration,
    preloadTutorialMovement,
    continueTutorialMovement,
    startTutorialStoryMovement,
    playGuidedGesturePreparation,
    startGuidedGesturePractice,
    playGuidedStoryTransition,
    waitForGuidedBars,
    waitForGuidedBeats,
    completeGuidedInterlude,
    getGuidedTransportMs: () => audioStore.getBaseRhythmTransportTimeMs(),
    stopTutorialMovement,
    resolveCurrentPhaseMovement,
    handlePoseFrame,
    forceCompleteGuidedRecognition,
    reportMapFrame,
    getCurrentMapFrame,
    dispose,
  };
};

export type MigrationActRuntimeService = ReturnType<
  typeof useMigrationActRuntime
>;
