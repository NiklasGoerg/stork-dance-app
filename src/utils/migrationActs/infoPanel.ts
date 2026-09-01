import type { GestureInteractionState } from "~/story/gestures";
import type {
  MigrationActEvent,
  MigrationActInfoPanelModel,
  MigrationGestureEvaluationResult,
  MigrationInfoPanelAction,
  MigrationMovementListItem,
} from "~/types/migrationAct";
import type { StoryTimelineDay } from "~/utils/storyCycle";
import { getMigrationGestureFeedbackCatalogEntry } from "~/utils/migrationActs/gestureFeedback";

type Translate = (
  key: string,
  params?: Record<string, string | number>,
) => string;

type SequenceEntry = Omit<MigrationMovementListItem, "label" | "state"> & {
  labelKey: string;
  timeMs: number;
};

const phaseMetadata: Record<
  StoryTimelineDay["phase"],
  { labelKey: string; instructionKey: string; detailKey?: string }
> = {
  summer_rest: {
    labelKey: "story.migrationPanel.movements.summerRest",
    instructionKey: "story.migrationPanel.instructions.summerRest",
    detailKey: "story.migrationPanel.instructions.followRhythm",
  },
  autumn_migration: {
    labelKey: "story.migrationPanel.movements.autumnMigration",
    instructionKey: "story.migrationPanel.instructions.autumnMigration",
    detailKey: "story.migrationPanel.instructions.flapAndStep",
  },
  winter_rest: {
    labelKey: "story.migrationPanel.movements.winterRest",
    instructionKey: "story.migrationPanel.instructions.winterRest",
  },
  spring_migration: {
    labelKey: "story.migrationPanel.movements.springMigration",
    instructionKey: "story.migrationPanel.instructions.springMigration",
    detailKey: "story.migrationPanel.instructions.returnStart",
  },
};

const getEventMetadata = (event: MigrationActEvent) => ({
  id: event.id,
  type: event.gestureId,
  labelKey:
    event.gestureId === "departure"
      ? "story.migrationPanel.movements.departure"
      : "story.migrationPanel.movements.arrival",
  timeMs: event.boundaryTimeMs,
});

export const buildMigrationMovementList = ({
  timeline,
  events,
  currentElapsedMs,
  activeEventId,
  translate,
}: {
  timeline: StoryTimelineDay[];
  events: MigrationActEvent[];
  currentElapsedMs: number;
  activeEventId: string | null;
  translate: Translate;
}): MigrationMovementListItem[] => {
  const phases = timeline.reduce<SequenceEntry[]>((items, day) => {
    if (items.at(-1)?.id === `phase-${day.phase}`) return items;

    return [
      ...items,
      {
        id: `phase-${day.phase}`,
        type:
          day.phase === "summer_rest" || day.phase === "winter_rest"
            ? "rest"
            : "migration",
        labelKey: phaseMetadata[day.phase].labelKey,
        timeMs: day.startMs,
      },
    ];
  }, []);
  const sequence = [...phases, ...events.map(getEventMetadata)].sort(
    (left, right) =>
      left.timeMs - right.timeMs ||
      Number(left.type === "rest" || left.type === "migration") -
        Number(right.type === "rest" || right.type === "migration"),
  );
  const activeIndex = activeEventId
    ? sequence.findIndex((item) => item.id === activeEventId)
    : sequence.findLastIndex((item) => item.timeMs <= currentElapsedMs);
  const resolvedActiveIndex = Math.max(0, activeIndex);
  const firstPhase = phases[0];

  if (firstPhase && resolvedActiveIndex >= sequence.length - 2) {
    sequence.push({
      ...firstPhase,
      id: `${firstPhase.id}-next-cycle`,
      timeMs: Number.POSITIVE_INFINITY,
    });
  }

  return sequence
    .map((item, index): MigrationMovementListItem => ({
      id: item.id,
      label: translate(item.labelKey),
      type: item.type,
      state:
        index < resolvedActiveIndex
          ? "completed"
          : index === resolvedActiveIndex
            ? "current"
            : "upcoming",
    }))
    .slice(Math.max(0, resolvedActiveIndex - 1), resolvedActiveIndex + 4);
};

const gestureActions = ({
  state,
  canContinue,
  showDevActions,
  translate,
}: {
  state: GestureInteractionState;
  canContinue: boolean;
  showDevActions: boolean;
  translate: Translate;
}): MigrationInfoPanelAction[] => {
  const actions: MigrationInfoPanelAction[] = [];

  if (canContinue && state === "retry-scheduled") {
    actions.push({
      id: "continueGesture",
      label: translate("common.continue"),
      primary: true,
    });
  }

  if (
    showDevActions &&
    (state === "attempt-playing" || state === "retry-scheduled")
  ) {
    actions.push(
      {
        id: "markGestureSuccessful",
        label: translate("gestures.overlay.markRecognized"),
        primary: true,
      },
      {
        id: "repeatGesture",
        label: translate("common.repeat"),
      },
    );
  }

  actions.push({
    id: "cancelGesture",
    label: translate("common.cancel"),
  });

  return actions;
};

export const buildMigrationActInfoPanelModel = ({
  translate,
  movements,
  playbackState,
  currentPhase,
  systemError,
  gestureState,
  gesturePhase = "idle",
  gestureId,
  gestureAttempt,
  gestureCueText,
  gestureFeedback,
  gestureFeedbackVisible,
  gestureCanContinue,
  movementFeedbackVisible,
  storyNarrationTitle,
  storyNarrationText,
  showDevActions,
  completed,
  showContinueAction,
}: {
  translate: Translate;
  movements: readonly MigrationMovementListItem[];
  playbackState: string;
  currentPhase: StoryTimelineDay["phase"] | null;
  systemError: string;
  gestureState: GestureInteractionState;
  gesturePhase?: "countdown" | "attempt" | "feedback" | "idle";
  gestureId: "departure" | "arrival" | null;
  gestureAttempt: number;
  gestureCueText: string;
  gestureFeedback: MigrationGestureEvaluationResult | null;
  gestureFeedbackVisible: boolean;
  gestureCanContinue: boolean;
  movementFeedbackVisible: boolean;
  storyNarrationTitle?: string;
  storyNarrationText?: string;
  showDevActions: boolean;
  completed: boolean;
  showContinueAction: boolean;
}): MigrationActInfoPanelModel => {
  if (systemError) {
    return {
      mode: "systemError",
      title: translate("story.migrationPanel.systemError"),
      feedbackText: systemError,
      tone: "error",
      movements,
      actions: [],
    };
  }

  if (gestureId && gestureFeedback && gestureFeedbackVisible) {
    const departure = gestureId === "departure";
    const instruction = translate(
      departure
        ? "story.migrationPanel.gestures.departure.preparation"
        : "story.migrationPanel.gestures.arrival.preparation",
    );
    const detail = gestureCueText
      ? gestureCueText
      : translate(
          departure
            ? "story.migrationPanel.gestures.departure.instruction"
            : "story.migrationPanel.gestures.arrival.instruction",
        );

    if (gestureFeedback.status === "success") {
      return {
        mode: "gestureFeedback",
        title: storyNarrationTitle ?? translate("common.ready"),
        instruction: storyNarrationText || instruction,
        detail: storyNarrationText ? undefined : detail,
        feedbackText: translate(
          departure
            ? "story.migrationPanel.success.departure.text"
            : "story.migrationPanel.success.arrival.text",
        ),
        feedbackPrimary: true,
        tone: "success",
        movements,
        actions: gestureActions({
          state: gestureState,
          canContinue: gestureCanContinue,
          showDevActions,
          translate,
        }),
      };
    }

    const catalog = getMigrationGestureFeedbackCatalogEntry(
      gestureFeedback.primaryFeedbackCode,
    );
    return {
      mode: "gestureFeedback",
      title: storyNarrationTitle ?? translate("common.ready"),
      instruction: storyNarrationText || instruction,
      detail: storyNarrationText ? undefined : detail,
      feedbackTitle: translate(
        catalog?.titleKey ?? "story.migrationPanel.feedback.tryAgain",
      ),
      feedbackText: translate(
        catalog?.textKey ?? "story.migrationPanel.feedback.genericRetry",
      ),
      tone: gestureFeedback.status === "not_evaluable" ? "warning" : "error",
      movements,
      actions: gestureActions({
        state: gestureState,
        canContinue: gestureCanContinue,
        showDevActions,
        translate,
      }),
    };
  }

  if (gestureId) {
    const departure = gestureId === "departure";
    return {
      mode: "gestureInstruction",
      title: translate(
        departure
          ? "story.migrationPanel.movements.departure"
          : "story.migrationPanel.movements.arrival",
      ),
      instruction: translate(
        departure
          ? "story.migrationPanel.gestures.departure.preparation"
          : "story.migrationPanel.gestures.arrival.preparation",
      ),
      detail:
        gesturePhase === "attempt" && gestureCueText
          ? gestureCueText
          : translate(
              departure
                ? "story.migrationPanel.gestures.departure.instruction"
                : "story.migrationPanel.gestures.arrival.instruction",
            ),
      status:
        gesturePhase === "countdown"
          ? translate("story.migrationPanel.gestures.demonstration")
          : gestureAttempt > 0
            ? translate("story.migrationPanel.gestures.attempt", {
                count: gestureAttempt,
              })
            : translate("common.ready"),
      tone: "neutral",
      movements,
      actions: gestureActions({
        state: gestureState,
        canContinue: gestureCanContinue,
        showDevActions,
        translate,
      }),
    };
  }

  if (playbackState === "cycle_transition") {
    return {
      mode: "cycleTransition",
      title: translate("story.acts.act2.cycleCompleted"),
      instruction: translate("story.migrationPanel.nextCycle"),
      tone: "neutral",
      movements,
      actions: [],
    };
  }

  if (completed) {
    return {
      mode: "completed",
      title: translate("story.migrationPanel.completed"),
      tone: "success",
      movements,
      actions: showContinueAction
        ? [
            {
              id: "continueToNextAct",
              label: translate("common.continue"),
              primary: true,
            },
          ]
        : [],
    };
  }

  const metadata = currentPhase
    ? phaseMetadata[currentPhase]
    : phaseMetadata.summer_rest;
  if (storyNarrationTitle || storyNarrationText) {
    return {
      mode: "storyNarration",
      title: storyNarrationTitle ?? translate(metadata.labelKey),
      instruction: storyNarrationText,
      feedbackText: movementFeedbackVisible
        ? translate("story.acts.act4.movementText.good")
        : undefined,
      feedbackPrimary: movementFeedbackVisible,
      tone: movementFeedbackVisible ? "success" : "neutral",
      movements,
      actions: [],
    };
  }

  if (movementFeedbackVisible) {
    return {
      mode: "movementFeedback",
      title: translate(metadata.labelKey),
      instruction: translate(metadata.instructionKey),
      feedbackText: translate("story.acts.act4.movementText.good"),
      feedbackPrimary: true,
      tone: "success",
      movements,
      actions: [],
    };
  }

  return {
    mode: "phaseInstruction",
    title: translate(metadata.labelKey),
    instruction: translate(metadata.instructionKey),
    detail: metadata.detailKey ? translate(metadata.detailKey) : undefined,
    status:
      playbackState === "paused"
        ? translate("story.acts.act4.instructions.paused")
        : undefined,
    tone: "neutral",
    movements,
    actions: [],
  };
};
