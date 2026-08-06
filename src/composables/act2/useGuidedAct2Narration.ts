import { computed, ref } from "vue";
import type { GuidedMigrationPhase } from "~/types/migrationAct";
import type { NarrationResult, NarrationSpeakOptions } from "~/types/narration";
import {
  guidedNarrationCatalog,
  resolveGuidedNarrationText,
  type GuidedNarrationId,
  type GuidedNarrationTokens,
} from "~/utils/act2/guidedNarrationCatalog";

const MOVEMENT_FAILURE_COOLDOWN_MS = 8_000;
const SPOKEN_CUE_START_WINDOW_MS = 550;
const SPOKEN_CUE_EXPIRY_MS = 4_000;
export const GUIDED_ACT2_NARRATION_RATE = 1;

export type GuidedNarrationState =
  | "idle"
  | "scheduled"
  | "ready"
  | "speaking"
  | "completed"
  | "expired"
  | "cancelled"
  | "skipped";

export type GuidedNarrationDiagnosticEvent = {
  id: string;
  eventId: string;
  phase: GuidedMigrationPhase;
  transportMs: number;
  outcome:
    | "scheduled"
    | "ready"
    | "displayed"
    | "speaking"
    | "completed"
    | "disabled"
    | "expired"
    | "priority"
    | "cooldown"
    | "cancelled";
  reason?: string;
};

type NarrationService = {
  speakText: (
    text: string,
    options?: Pick<
      NarrationSpeakOptions,
      "behavior" | "rate" | "onStart" | "onEnd"
    >,
  ) => Promise<NarrationResult> | NarrationResult;
  stop: () => void;
};

type CueLifecycle = {
  token: number;
  id: string;
  eventId: string;
  text: string;
  title: string;
  priority: number;
  protectedWindow: boolean;
  phaseInstance: number;
  state: GuidedNarrationState;
  scheduledAtTransportMs: number;
  displayStartedAtTransportMs: number | null;
  speechRequestedAtTransportMs: number | null;
  speechActuallyStartedAtTransportMs: number | null;
  speechEndedAtTransportMs: number | null;
  latestStartTransportMs: number;
  expiresAtTransportMs: number;
  estimatedDurationMs: number | null;
  actualDurationMs: number | null;
  speechRate: number;
  voiceName: string | null;
  cancellationReason: string | null;
  skipReason: string | null;
};

export const useGuidedAct2Narration = ({
  narration,
  getTransportMs,
  getTokens,
}: {
  narration?: NarrationService;
  getTransportMs: () => number;
  getTokens: () => GuidedNarrationTokens;
}) => {
  const phase = ref<GuidedMigrationPhase>("idle");
  const currentId = ref<string>("act2.introduction.title");
  const currentText = ref(
    guidedNarrationCatalog["act2.introduction.title"].text,
  );
  const currentTitle = ref(
    guidedNarrationCatalog["act2.introduction.title"].title,
  );
  const lifecycle = ref<CueLifecycle | null>(null);
  const failureCooldownUntilMs = ref(0);
  const cancellationReason = ref<string | null>(null);
  const skipReason = ref<string | null>(null);
  const events = ref<GuidedNarrationDiagnosticEvent[]>([]);
  const handledEventIds = new Set<string>();
  let phaseInstance = 0;
  let token = 0;

  const record = (
    id: string,
    eventId: string,
    outcome: GuidedNarrationDiagnosticEvent["outcome"],
    reason?: string,
  ) => {
    events.value = [
      ...events.value.slice(-99),
      {
        id,
        eventId,
        phase: phase.value,
        transportMs: getTransportMs(),
        outcome,
        reason,
      },
    ];
    if (import.meta.dev) {
      console.debug("[GuidedAct2:narration]", events.value.at(-1));
    }
  };

  const show = (cueLifecycle: CueLifecycle, transportMs: number) => {
    currentId.value = cueLifecycle.id;
    currentTitle.value = cueLifecycle.title;
    currentText.value = cueLifecycle.text;
    cueLifecycle.displayStartedAtTransportMs ??= transportMs;
    record(cueLifecycle.id, cueLifecycle.eventId, "displayed");
  };

  const cancelActive = (reason: string, forceStop = false) => {
    const active = lifecycle.value;
    token++;
    if (active && ["scheduled", "ready", "speaking"].includes(active.state)) {
      active.state = "cancelled";
      active.cancellationReason = reason;
      record(active.id, active.eventId, "cancelled", reason);
    }
    if (forceStop || (active && ["cancelled"].includes(active.state))) {
      narration?.stop();
    }
    cancellationReason.value = reason;
  };

  const cancel = (reason: string) => cancelActive(reason, true);

  const enterPhase = (nextPhase: GuidedMigrationPhase) => {
    if (phase.value === nextPhase) return;
    phaseInstance++;
    const active = lifecycle.value;
    if (
      active &&
      ["scheduled", "ready", "speaking"].includes(active.state) &&
      !active.protectedWindow
    ) {
      cancelActive(`phase:${phase.value}->${nextPhase}`);
    }
    phase.value = nextPhase;
  };

  const scheduleSpokenCue = ({
    id,
    eventId,
    title,
    text,
    priority,
    estimatedDurationMs,
    failure,
  }: {
    id: string;
    eventId: string;
    title: string;
    text: string;
    priority: number;
    estimatedDurationMs: number | null;
    failure: boolean;
  }) => {
    const now = getTransportMs();
    const active = lifecycle.value;
    if (
      active &&
      ["scheduled", "ready", "speaking"].includes(active.state) &&
      priority < active.priority
    ) {
      skipReason.value = `priority:${active.id}`;
      record(id, eventId, "priority", skipReason.value);
      return true;
    }
    if (failure && now < failureCooldownUntilMs.value) {
      skipReason.value = "failure-cooldown";
      record(id, eventId, "cooldown", skipReason.value);
      return true;
    }
    if (failure)
      failureCooldownUntilMs.value = now + MOVEMENT_FAILURE_COOLDOWN_MS;
    if (active && ["scheduled", "ready", "speaking"].includes(active.state)) {
      cancelActive(`replaced-by:${id}`);
    }

    const cueToken = ++token;
    const cueLifecycle: CueLifecycle = {
      token: cueToken,
      id,
      eventId,
      text,
      title,
      priority,
      protectedWindow: priority >= 60,
      phaseInstance,
      state: "scheduled",
      scheduledAtTransportMs: now,
      displayStartedAtTransportMs: null,
      speechRequestedAtTransportMs: null,
      speechActuallyStartedAtTransportMs: null,
      speechEndedAtTransportMs: null,
      latestStartTransportMs: now + SPOKEN_CUE_START_WINDOW_MS,
      expiresAtTransportMs: now + SPOKEN_CUE_EXPIRY_MS,
      estimatedDurationMs,
      actualDurationMs: null,
      speechRate: GUIDED_ACT2_NARRATION_RATE,
      voiceName: null,
      cancellationReason: null,
      skipReason: null,
    };
    lifecycle.value = cueLifecycle;
    cancellationReason.value = null;
    skipReason.value = null;
    record(id, eventId, "scheduled");

    if (!narration) {
      cueLifecycle.state = "completed";
      show(cueLifecycle, now);
      record(id, eventId, "completed", "tts-unavailable");
      return true;
    }

    cueLifecycle.state = "ready";
    cueLifecycle.speechRequestedAtTransportMs = now;
    record(id, eventId, "ready");
    void Promise.resolve(
      narration.speakText(text, {
        behavior: "replace",
        rate: GUIDED_ACT2_NARRATION_RATE,
        onStart: ({ rate, voiceName }) => {
          if (cueToken !== token || lifecycle.value?.token !== cueToken) return;
          const startedAt = getTransportMs();
          const wrongPhase =
            cueLifecycle.phaseInstance !== phaseInstance &&
            !cueLifecycle.protectedWindow;
          if (startedAt > cueLifecycle.latestStartTransportMs || wrongPhase) {
            cueLifecycle.state = "expired";
            cueLifecycle.skipReason = wrongPhase
              ? "phase-invalidated-before-start"
              : "latest-start-missed";
            skipReason.value = cueLifecycle.skipReason;
            record(id, eventId, "expired", cueLifecycle.skipReason);
            narration.stop();
            return;
          }
          cueLifecycle.state = "speaking";
          cueLifecycle.speechActuallyStartedAtTransportMs = startedAt;
          cueLifecycle.speechRate = rate;
          cueLifecycle.voiceName = voiceName;
          show(cueLifecycle, startedAt);
          record(id, eventId, "speaking");
        },
        onEnd: ({ status, rate, voiceName }) => {
          if (cueToken !== token || lifecycle.value?.token !== cueToken) return;
          const endedAt = getTransportMs();
          cueLifecycle.speechEndedAtTransportMs = endedAt;
          cueLifecycle.speechRate = rate;
          cueLifecycle.voiceName = voiceName;
          if (cueLifecycle.speechActuallyStartedAtTransportMs !== null) {
            cueLifecycle.actualDurationMs = Math.max(
              0,
              endedAt - cueLifecycle.speechActuallyStartedAtTransportMs,
            );
          }
          if (cueLifecycle.state === "expired") return;
          cueLifecycle.state =
            status === "completed" ? "completed" : "cancelled";
          record(
            id,
            eventId,
            status === "completed" ? "completed" : "cancelled",
            status,
          );
        },
      }),
    )
      .then((result) => {
        if (cueToken !== token || lifecycle.value?.token !== cueToken) return;
        if (
          cueLifecycle.speechActuallyStartedAtTransportMs === null &&
          cueLifecycle.state !== "expired"
        ) {
          const shouldDisplayWithoutSpeech = [
            "disabled",
            "unsupported",
            "error",
          ].includes(result.status);
          if (shouldDisplayWithoutSpeech) {
            show(cueLifecycle, getTransportMs());
          }
          cueLifecycle.state = "skipped";
          cueLifecycle.skipReason = `tts-${result.status}`;
          skipReason.value = cueLifecycle.skipReason;
        }
      })
      .catch(() => {
        if (cueToken !== token || lifecycle.value?.token !== cueToken) return;
        show(cueLifecycle, getTransportMs());
        cueLifecycle.state = "skipped";
        cueLifecycle.skipReason = "tts-error";
        skipReason.value = cueLifecycle.skipReason;
      });
    return true;
  };

  const present = (
    id: GuidedNarrationId,
    eventId = `${id}:${getTransportMs()}`,
  ) => {
    if (handledEventIds.has(eventId)) return false;
    handledEventIds.add(eventId);
    const item = guidedNarrationCatalog[id];
    if (!item.enabled) {
      record(id, eventId, "disabled");
      return false;
    }
    if (!item.phases.includes(phase.value)) return false;
    const text = resolveGuidedNarrationText(id, getTokens());
    if (!item.speak) {
      const now = getTransportMs();
      const active = lifecycle.value;
      if (
        active &&
        ["scheduled", "ready", "speaking"].includes(active.state) &&
        item.priority < active.priority
      ) {
        skipReason.value = `priority:${active.id}`;
        record(id, eventId, "priority", skipReason.value);
        return true;
      }
      const displayLifecycle: CueLifecycle = {
        token: ++token,
        id,
        eventId,
        text,
        title: item.title,
        priority: item.priority,
        protectedWindow: false,
        phaseInstance,
        state: "completed",
        scheduledAtTransportMs: now,
        displayStartedAtTransportMs: now,
        speechRequestedAtTransportMs: null,
        speechActuallyStartedAtTransportMs: null,
        speechEndedAtTransportMs: null,
        latestStartTransportMs: now,
        expiresAtTransportMs: now,
        estimatedDurationMs: 0,
        actualDurationMs: null,
        speechRate: GUIDED_ACT2_NARRATION_RATE,
        voiceName: null,
        cancellationReason: null,
        skipReason: null,
      };
      lifecycle.value = displayLifecycle;
      show(displayLifecycle, now);
      return true;
    }
    return scheduleSpokenCue({
      id,
      eventId,
      title: item.title,
      text,
      priority: item.priority,
      estimatedDurationMs: item.estimatedDurationMs,
      failure: item.trigger.type === "movement-failure",
    });
  };

  const presentExternal = ({
    id,
    title,
    text,
    priority,
    eventId,
  }: {
    id: string;
    title: string;
    text: string;
    priority: number;
    eventId: string;
  }) => {
    if (handledEventIds.has(eventId)) return false;
    handledEventIds.add(eventId);
    return scheduleSpokenCue({
      id,
      eventId,
      title,
      text,
      priority,
      estimatedDurationMs: null,
      failure: true,
    });
  };

  const reset = (reason = "reset") => {
    cancelActive(reason, true);
    phase.value = "idle";
    phaseInstance++;
    handledEventIds.clear();
    failureCooldownUntilMs.value = 0;
    currentId.value = "act2.introduction.title";
    currentTitle.value =
      guidedNarrationCatalog["act2.introduction.title"].title;
    currentText.value = guidedNarrationCatalog["act2.introduction.title"].text;
    lifecycle.value = null;
    skipReason.value = null;
  };

  return {
    enterPhase,
    present,
    presentExternal,
    cancel,
    reset,
    panelContent: computed(() => ({
      id: currentId.value,
      title: currentTitle.value,
      text: currentText.value,
    })),
    diagnostics: computed(() => {
      const current = lifecycle.value;
      return {
        currentNarrationId: current?.id ?? currentId.value,
        currentNarrationState: current?.state ?? "idle",
        currentNarrationText: current?.text ?? currentText.value,
        priority: current?.priority ?? 0,
        scheduledAtTransportMs: current?.scheduledAtTransportMs ?? null,
        displayStartedAtTransportMs:
          current?.displayStartedAtTransportMs ?? null,
        speechRequestedAtTransportMs:
          current?.speechRequestedAtTransportMs ?? null,
        speechActuallyStartedAtTransportMs:
          current?.speechActuallyStartedAtTransportMs ?? null,
        speechEndedAtTransportMs: current?.speechEndedAtTransportMs ?? null,
        displaySpeechLeadMs:
          current &&
          current.displayStartedAtTransportMs !== null &&
          current.speechActuallyStartedAtTransportMs !== null
            ? current.speechActuallyStartedAtTransportMs -
              current.displayStartedAtTransportMs
            : null,
        estimatedDurationMs: current?.estimatedDurationMs ?? null,
        actualDurationMs: current?.actualDurationMs ?? null,
        speechRate: current?.speechRate ?? GUIDED_ACT2_NARRATION_RATE,
        voiceName: current?.voiceName ?? null,
        latestStartTransportMs: current?.latestStartTransportMs ?? null,
        expiresAtTransportMs: current?.expiresAtTransportMs ?? null,
        cancellationReason:
          current?.cancellationReason ?? cancellationReason.value,
        skipReason: current?.skipReason ?? skipReason.value,
        failureCooldownUntilMs: failureCooldownUntilMs.value,
        resolvedTokens: getTokens(),
        events: events.value,
      };
    }),
  };
};
